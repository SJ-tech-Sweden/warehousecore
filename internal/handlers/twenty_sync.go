package handlers

// twenty_sync.go — two-way integration helpers between WarehouseCore and Twenty CRM.
//
//  • syncProductsToTwenty: reads every local product and upserts it to Twenty.
//  • TwentySyncProductsHandler: POST /api/v1/twenty/sync-products.
//  • bootstrapTwentyJobIDs: auto-creates local jobs for new Opportunities.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"warehousecore/internal/repository"
	"warehousecore/internal/services"
)

type whProductRow struct {
	ProductID    int
	Name         string
	CategoryName string
}

type whpNode struct {
	ID          string  `json:"id"`
	WarehouseID float64 `json:"warehouseId"`
}

type whpEdge struct {
	Node whpNode `json:"node"`
}

type whpListEdges struct {
	Edges []whpEdge `json:"edges"`
}

// RegisterTwentySyncHook wires the scheduler hook to the product sync logic.
// Call once during startup after DB init.
func RegisterTwentySyncHook() {
	services.TwentyProductSyncHook = func() (int, int, error) {
		return syncProductsToTwenty(context.Background())
	}
}

// syncProductsToTwenty reads all products from the local database and
// creates or updates corresponding WarehouseCoreProduct records in Twenty.
// Existing records are matched by the warehouseId field.
func syncProductsToTwenty(ctx context.Context) (created, updated int, err error) {
	if !twentyConfigured() {
		return 0, 0, fmt.Errorf("Twenty not configured")
	}

	db := repository.GetSQLDB()
	rows, qErr := db.QueryContext(ctx, `
		SELECT p.productid, p.name, COALESCE(c.name, '') AS category_name
		FROM products p
		LEFT JOIN categories c ON c.categoryid = p.categoryid
		ORDER BY p.productid
	`)
	if qErr != nil {
		return 0, 0, fmt.Errorf("query products: %w", qErr)
	}
	defer rows.Close()

	var products []whProductRow
	for rows.Next() {
		var pr whProductRow
		if scanErr := rows.Scan(&pr.ProductID, &pr.Name, &pr.CategoryName); scanErr != nil {
			return 0, 0, fmt.Errorf("scan product row: %w", scanErr)
		}
		products = append(products, pr)
	}
	if rowErr := rows.Err(); rowErr != nil {
		return 0, 0, fmt.Errorf("iterate products: %w", rowErr)
	}
	if len(products) == 0 {
		return 0, 0, nil
	}

	nodes, fErr := loadExistingWarehouseCoreProducts(ctx)
	if fErr != nil {
		return 0, 0, fmt.Errorf("fetch existing warehouseCoreProducts: %w", fErr)
	}

	byWarehouseID := make(map[int]string, len(nodes))
	for _, e := range nodes {
		byWarehouseID[int(e.Node.WarehouseID)] = e.Node.ID
	}

	syncedAt := time.Now().UTC().Format(time.RFC3339)
	for _, p := range products {
		twentyID, exists := byWarehouseID[p.ProductID]
		if exists {
			const updateQ = `mutation UpdateWHProduct($id: ID!, $productName: String!, $categoryName: String!, $lastSyncAt: DateTime!) {
				updateOneWarehouseCoreProduct(id: $id, data: {
					productName: $productName
					categoryName: $categoryName
					lastSyncAt: $lastSyncAt
				}) { id }
			}`
			if uErr := doTwentyGraphQLRoot(ctx, updateQ, map[string]interface{}{
				"id":           twentyID,
				"productName":  p.Name,
				"categoryName": p.CategoryName,
				"lastSyncAt":   syncedAt,
			}, "updateOneWarehouseCoreProduct", nil); uErr != nil {
				log.Printf("[TWENTY SYNC] update product %d: %v", p.ProductID, uErr)
				continue
			}
			updated++
		} else {
			const createQ = `mutation CreateWHProduct($warehouseId: Float!, $productName: String!, $categoryName: String!, $lastSyncAt: DateTime!) {
				createOneWarehouseCoreProduct(data: {
					warehouseId: $warehouseId
					productName: $productName
					categoryName: $categoryName
					lastSyncAt: $lastSyncAt
				}) { id warehouseId }
			}`
			if cErr := doTwentyGraphQLRoot(ctx, createQ, map[string]interface{}{
				"warehouseId":  float64(p.ProductID),
				"productName":  p.Name,
				"categoryName": p.CategoryName,
				"lastSyncAt":   syncedAt,
			}, "createOneWarehouseCoreProduct", nil); cErr != nil {
				log.Printf("[TWENTY SYNC] create product %d: %v", p.ProductID, cErr)
				continue
			}
			created++
		}
	}

	return created, updated, nil
}

// TwentySyncProductsHandler triggers a full product sync and returns a summary.
func TwentySyncProductsHandler(w http.ResponseWriter, r *http.Request) {
	created, updated, err := syncProductsToTwenty(r.Context())
	if err != nil {
		log.Printf("[TWENTY SYNC] product sync failed: %v", err)
		respondJSON(w, http.StatusInternalServerError, map[string]interface{}{
			"ok":    false,
			"error": fmt.Sprintf("sync failed: %v", err),
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":      true,
		"created": created,
		"updated": updated,
	})
}

func loadExistingWarehouseCoreProducts(ctx context.Context) ([]whpEdge, error) {
	// Variant A: direct list shape on older schemas.
	const directFindManyQ = `query {
		findManyWarehouseCoreProducts {
			id
			warehouseId
		}
	}`
	var direct []whpNode
	if err := doTwentyGraphQLRoot(ctx, directFindManyQ, nil, "findManyWarehouseCoreProducts", &direct); err == nil {
		edges := make([]whpEdge, 0, len(direct))
		for _, n := range direct {
			edges = append(edges, whpEdge{Node: n})
		}
		return edges, nil
	}

	// Variant B: connection shape on newer schemas.
	const connectionQ = `query {
		warehouseCoreProducts {
			edges { node { id warehouseId } }
		}
	}`
	var connection whpListEdges
	if err := doTwentyGraphQLRoot(ctx, connectionQ, nil, "warehouseCoreProducts", &connection); err == nil {
		return connection.Edges, nil
	}

	// Variant C: edges/node shape on older schemas.
	const edgesFindManyQ = `query {
		findManyWarehouseCoreProducts {
			edges { node { id warehouseId } }
		}
	}`
	var edgeList whpListEdges
	if err := doTwentyGraphQLRoot(ctx, edgesFindManyQ, nil, "findManyWarehouseCoreProducts", &edgeList); err == nil {
		return edgeList.Edges, nil
	}

	// Prefer a clear hint for the most common failure mode.
	errFindMany := doTwentyGraphQLRoot(ctx, directFindManyQ, nil, "findManyWarehouseCoreProducts", &direct)
	errConnection := doTwentyGraphQLRoot(ctx, connectionQ, nil, "warehouseCoreProducts", &connection)
	if errFindMany != nil && errConnection != nil {
		errMsg := errFindMany.Error() + " | " + errConnection.Error()
		if strings.Contains(errMsg, "Cannot query field \"findManyWarehouseCoreProducts\" on type \"Query\"") &&
			strings.Contains(errMsg, "Cannot query field \"warehouseCoreProducts\" on type \"Query\"") {
			return nil, fmt.Errorf("Twenty object WarehouseCoreProduct is not deployed yet; run 'yarn twenty dev --once' in your Twenty app and verify object sync")
		}
		return nil, errFindMany
	}

	return nil, fmt.Errorf("unable to parse findManyWarehouseCoreProducts response")
}

// bootstrapTwentyJobIDs finds Twenty Opportunities that have no
// warehouseCoreJobId and auto-assigns one by inserting a row into the local
// jobs table, then writing the integer ID back to Twenty.
func bootstrapTwentyJobIDs(ctx context.Context) {
	cfg, cfgErr := services.GetTwentyConfig()
	if cfgErr != nil {
		log.Printf("[TWENTY BOOTSTRAP] failed to load config: %v", cfgErr)
		return
	}
	if !cfg.EnableJobBootstrap {
		return
	}
	if !twentyConfigured() {
		return
	}

	const findManyQ = `query {
		findManyOpportunities(filter: { warehouseCoreJobId: { is: NULL } }) {
			edges { node { id name jobCode } }
		}
	}`
	const opportunitiesQ = `query {
		opportunities(filter: { warehouseCoreJobId: { is: NULL } }) {
			edges { node { id name jobCode } }
		}
	}`
	type oppNode struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		JobCode string `json:"jobCode"`
	}
	type oppEdge struct {
		Node oppNode `json:"node"`
	}
	type oppList struct {
		Edges []oppEdge `json:"edges"`
	}

	var list oppList
	if err := doTwentyGraphQLRoot(ctx, findManyQ, nil, "findManyOpportunities", &list); err != nil {
		if err2 := doTwentyGraphQLRoot(ctx, opportunitiesQ, nil, "opportunities", &list); err2 != nil {
			log.Printf("[TWENTY BOOTSTRAP] fetch opportunities: %v", err2)
			return
		}
	}
	if len(list.Edges) == 0 {
		return
	}

	db := repository.GetSQLDB()
	for _, e := range list.Edges {
		opp := e.Node
		jobCode := opp.JobCode
		if jobCode == "" {
			jobCode = opp.Name
		}

		var localID int64
		insErr := db.QueryRowContext(ctx,
			`INSERT INTO jobs (job_code, status) VALUES ($1, 'open') RETURNING id`,
			jobCode,
		).Scan(&localID)
		if insErr != nil {
			log.Printf("[TWENTY BOOTSTRAP] insert job for opportunity %s: %v", opp.ID, insErr)
			continue
		}

		const updateOneQ = `mutation BootstrapJobID($id: ID!, $jobId: Float!) {
			updateOneOpportunity(id: $id, data: { warehouseCoreJobId: $jobId }) {
				id warehouseCoreJobId
			}
		}`
		const updateQ = `mutation BootstrapJobID($id: ID!, $jobId: Float!) {
			updateOpportunity(id: $id, data: { warehouseCoreJobId: $jobId }) {
				id warehouseCoreJobId
			}
		}`

		vars := map[string]interface{}{
			"id":    opp.ID,
			"jobId": float64(localID),
		}

		mutErr := doTwentyGraphQLRoot(ctx, updateOneQ, vars, "updateOneOpportunity", nil)
		if mutErr != nil {
			mutErr = doTwentyGraphQLRoot(ctx, updateQ, vars, "updateOpportunity", nil)
		}
		if mutErr != nil {
			log.Printf("[TWENTY BOOTSTRAP] write-back job ID %d for opportunity %s: %v", localID, opp.ID, mutErr)
			if _, delErr := db.ExecContext(ctx, `DELETE FROM jobs WHERE id = $1`, localID); delErr != nil {
				log.Printf("[TWENTY BOOTSTRAP] rollback job row %d: %v", localID, delErr)
			}
			continue
		}

		log.Printf("[TWENTY BOOTSTRAP] linked opportunity %s -> job ID %d", opp.ID, localID)
	}
}
