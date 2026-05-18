package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"warehousecore/internal/repository"
)

type twentyRequirementNode struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Quantity             *float64 `json:"quantity"`
	UnitPrice            *float64 `json:"unitPrice"`
	LineTotal            *float64 `json:"lineTotal"`
	WarehouseCoreProduct *float64 `json:"warehouseCoreProductId"`
	WarehouseProduct     *struct {
		ID          string   `json:"id"`
		WarehouseID *float64 `json:"warehouseId"`
	} `json:"warehouseProduct"`
}

// twentyRequirementList accepts both legacy array responses and connection-style
// objects (edges/nodes) returned by different Twenty versions.
type twentyRequirementList []twentyRequirementNode

func (l *twentyRequirementList) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*l = nil
		return nil
	}

	if strings.HasPrefix(trimmed, "[") {
		var arr []twentyRequirementNode
		if err := json.Unmarshal(data, &arr); err != nil {
			return err
		}
		*l = arr
		return nil
	}

	type edge struct {
		Node twentyRequirementNode `json:"node"`
	}
	type connection struct {
		Edges []edge                  `json:"edges"`
		Nodes []twentyRequirementNode `json:"nodes"`
	}

	var conn connection
	if err := json.Unmarshal(data, &conn); err != nil {
		return err
	}

	if len(conn.Nodes) > 0 {
		*l = conn.Nodes
		return nil
	}

	rows := make([]twentyRequirementNode, 0, len(conn.Edges))
	for _, e := range conn.Edges {
		rows = append(rows, e.Node)
	}
	*l = rows
	return nil
}

type twentyOpportunityRequirementNode struct {
	ID                 string                `json:"id"`
	WarehouseCoreJobID *float64              `json:"warehouseCoreJobId"`
	UpdatedAt          *string               `json:"updatedAt"`
	JobRequirements    twentyRequirementList `json:"jobProductRequirements"`
}

type twentyOpportunityRequirementEdge struct {
	Node twentyOpportunityRequirementNode `json:"node"`
}

type twentyOpportunityRequirementConnection struct {
	Edges []twentyOpportunityRequirementEdge `json:"edges"`
}

type jobProductOption struct {
	ProductID    int    `json:"product_id"`
	Name         string `json:"name"`
	CategoryName string `json:"category_name"`
}

type localJobRequirementInput struct {
	ProductID int `json:"product_id"`
	Quantity  int `json:"quantity"`
}

func replaceLocalJobRequirements(jobID int, requirements []localJobRequirementInput) error {
	db := repository.GetSQLDB()
	jobReqCols, err := getTableColumnsForDB(db, "job_product_requirements")
	if err != nil {
		return err
	}
	if !jobReqCols["job_id"] || !jobReqCols["product_id"] || !jobReqCols["quantity"] {
		return fmt.Errorf("job_product_requirements table is unavailable")
	}

	jobCols, err := getTableColumnsForDB(db, "jobs")
	if err != nil {
		return err
	}
	jobPKCol := "jobid"
	if !jobCols["jobid"] && jobCols["id"] {
		jobPKCol = "id"
	}

	var jobExists bool
	if err := db.QueryRow(fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM jobs WHERE %s = $1)", jobPKCol), jobID).Scan(&jobExists); err != nil {
		return err
	}
	if !jobExists {
		return sql.ErrNoRows
	}

	filtered := make([]localJobRequirementInput, 0, len(requirements))
	seen := make(map[int]bool)
	for _, req := range requirements {
		if req.ProductID <= 0 || req.Quantity <= 0 || seen[req.ProductID] {
			continue
		}
		seen[req.ProductID] = true
		filtered = append(filtered, req)
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM job_product_requirements WHERE job_id = $1", jobID); err != nil {
		return err
	}

	for _, req := range filtered {
		if _, err := tx.Exec(`
			INSERT INTO job_product_requirements (job_id, product_id, quantity)
			VALUES ($1, $2, $3)
		`, jobID, req.ProductID, req.Quantity); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func upsertLocalJobRequirement(jobID int, productID int, quantity int) error {
	db := repository.GetSQLDB()
	jobReqCols, err := getTableColumnsForDB(db, "job_product_requirements")
	if err != nil {
		return err
	}
	if !jobReqCols["job_id"] || !jobReqCols["product_id"] || !jobReqCols["quantity"] {
		return fmt.Errorf("job_product_requirements table is unavailable")
	}

	jobCols, err := getTableColumnsForDB(db, "jobs")
	if err != nil {
		return err
	}
	jobPKCol := "jobid"
	if !jobCols["jobid"] && jobCols["id"] {
		jobPKCol = "id"
	}

	var jobExists bool
	if err := db.QueryRow(fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM jobs WHERE %s = $1)", jobPKCol), jobID).Scan(&jobExists); err != nil {
		return err
	}
	if !jobExists {
		return sql.ErrNoRows
	}

	if quantity <= 0 {
		_, err := db.Exec("DELETE FROM job_product_requirements WHERE job_id = $1 AND product_id = $2", jobID, productID)
		return err
	}

	result, err := db.Exec("UPDATE job_product_requirements SET quantity = $3 WHERE job_id = $1 AND product_id = $2", jobID, productID, quantity)
	if err != nil {
		return err
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		return nil
	}
	_, err = db.Exec(`INSERT INTO job_product_requirements (job_id, product_id, quantity) VALUES ($1, $2, $3)`, jobID, productID, quantity)
	return err
}

func ReplaceJobRequirements(w http.ResponseWriter, r *http.Request) {
	jobID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || jobID <= 0 {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid job id"})
		return
	}

	var req struct {
		Requirements []localJobRequirementInput `json:"requirements"`
	}
	if decodeErr := json.NewDecoder(r.Body).Decode(&req); decodeErr != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := replaceLocalJobRequirements(jobID, req.Requirements); err != nil {
		if err == sql.ErrNoRows {
			respondJSON(w, http.StatusNotFound, map[string]string{"error": "job not found"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to save requirements: %v", err)})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":           true,
		"job_id":       jobID,
		"saved_count":  len(req.Requirements),
		"requirements": req.Requirements,
	})
}

// GetJobRequirementProductOptions returns products for the guided
// "add requirement" picker in the Jobs page.
func GetJobRequirementProductOptions(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) > 120 {
		q = q[:120]
	}

	limit := 100
	if rawLimit := strings.TrimSpace(r.URL.Query().Get("limit")); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil {
			if parsed < 1 {
				parsed = 1
			}
			if parsed > 300 {
				parsed = 300
			}
			limit = parsed
		}
	}

	db := repository.GetSQLDB()
	query := `
		SELECT p.productID, p.name, COALESCE(c.name, '') AS category_name
		FROM products p
		LEFT JOIN categories c ON c.categoryID = p.categoryID
		WHERE ($1 = '' OR p.name ILIKE $2)
		ORDER BY p.name
		LIMIT $3
	`
	pattern := "%" + q + "%"
	rows, err := db.Query(query, q, pattern, limit)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch product options"})
		return
	}
	defer rows.Close()

	items := make([]jobProductOption, 0)
	for rows.Next() {
		var item jobProductOption
		if scanErr := rows.Scan(&item.ProductID, &item.Name, &item.CategoryName); scanErr != nil {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read product options"})
			return
		}
		items = append(items, item)
	}
	if rowErr := rows.Err(); rowErr != nil {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read product options"})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"products": items,
		"count":    len(items),
	})
}

// UpsertJobRequirement writes a product requirement to the linked Twenty
// Opportunity for this WarehouseCore job.
func UpsertJobRequirement(w http.ResponseWriter, r *http.Request) {
	jobID, err := strconv.Atoi(mux.Vars(r)["id"])
	if err != nil || jobID <= 0 {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid job id"})
		return
	}

	var req struct {
		ProductID int `json:"product_id"`
		Quantity  int `json:"quantity"`
	}
	if decodeErr := json.NewDecoder(r.Body).Decode(&req); decodeErr != nil {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if req.ProductID <= 0 {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "product_id must be > 0"})
		return
	}
	if req.Quantity <= 0 {
		if err := upsertLocalJobRequirement(jobID, req.ProductID, 0); err != nil && err != sql.ErrNoRows {
			respondJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to delete local requirement: %v", err)})
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"ok":        true,
			"action":    "deleted",
			"job_id":    jobID,
			"product_id": req.ProductID,
			"quantity":  0,
		})
		return
	}

	if localErr := upsertLocalJobRequirement(jobID, req.ProductID, req.Quantity); localErr != nil && localErr != sql.ErrNoRows {
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to save local requirement: %v", localErr)})
		return
	}

	if !twentyConfigured() {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"ok":         true,
			"action":     "updated",
			"job_id":     jobID,
			"product_id": req.ProductID,
			"quantity":   req.Quantity,
		})
		return
	}

	productName, unitPrice, nameErr := loadLocalProductPricing(req.ProductID)
	if nameErr != nil {
		if nameErr == sql.ErrNoRows {
			respondJSON(w, http.StatusNotFound, map[string]string{"error": "product not found"})
			return
		}
		respondJSON(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("failed to load product: %v", nameErr)})
		return
	}
	lineTotal := unitPrice * float64(req.Quantity)

	opp, oppErr := loadTwentyOpportunityForJob(r.Context(), jobID)
	if oppErr != nil {
		respondJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to load linked opportunity: %v", oppErr)})
		return
	}
	if opp == nil {
		respondJSON(w, http.StatusNotFound, map[string]string{"error": "no Twenty opportunity linked to this job"})
		return
	}

	productTwentyID, prodMapErr := resolveTwentyProductRecordID(r.Context(), req.ProductID)
	if prodMapErr != nil {
		respondJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to resolve Twenty product mapping: %v", prodMapErr)})
		return
	}
	if productTwentyID == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "product is not synced to Twenty yet; run Twenty product sync first"})
		return
	}

	existingRequirementID := ""
	for _, line := range opp.JobRequirements {
		lineProductID := 0
		if line.WarehouseCoreProduct != nil {
			lineProductID = int(*line.WarehouseCoreProduct)
		}
		if lineProductID <= 0 && line.WarehouseProduct != nil && line.WarehouseProduct.WarehouseID != nil {
			lineProductID = int(*line.WarehouseProduct.WarehouseID)
		}
		if lineProductID == req.ProductID {
			existingRequirementID = strings.TrimSpace(line.ID)
			break
		}
	}

	quantity := float64(req.Quantity)
	if existingRequirementID != "" {
		if err := updateTwentyRequirement(r.Context(), existingRequirementID, productName, quantity, req.ProductID, productTwentyID, unitPrice, lineTotal); err != nil {
			respondJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to update requirement: %v", err)})
			return
		}
		_ = updateOpportunityEstimatedTotal(r.Context(), opp)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"ok":         true,
			"action":     "updated",
			"job_id":     jobID,
			"product_id": req.ProductID,
			"quantity":   req.Quantity,
		})
		return
	}

	if err := createTwentyRequirement(r.Context(), opp.ID, productName, quantity, req.ProductID, productTwentyID, unitPrice, lineTotal); err != nil {
		respondJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("failed to create requirement: %v", err)})
		return
	}
	_ = updateOpportunityEstimatedTotal(r.Context(), opp)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"ok":         true,
		"action":     "created",
		"job_id":     jobID,
		"product_id": req.ProductID,
		"quantity":   req.Quantity,
	})
}

func loadLocalProductPricing(productID int) (name string, unitPrice float64, err error) {
	db := repository.GetSQLDB()
	err = db.QueryRow(`SELECT name, COALESCE(itemcostperday, 0) FROM products WHERE productID = $1`, productID).Scan(&name, &unitPrice)
	if err != nil {
		return "", 0, err
	}
	return strings.TrimSpace(name), unitPrice, nil
}

func resolveTwentyProductRecordID(ctx context.Context, localProductID int) (string, error) {
	nodes, err := loadExistingWarehouseCoreProducts(ctx)
	if err != nil {
		return "", err
	}
	for _, edge := range nodes {
		if int(edge.Node.WarehouseID) == localProductID {
			return strings.TrimSpace(edge.Node.ID), nil
		}
	}
	return "", nil
}

func loadTwentyOpportunityForJob(ctx context.Context, jobID int) (*twentyOpportunityRequirementNode, error) {
	const findManyWithRelationQ = `query {
		findManyOpportunities {
			id
			warehouseCoreJobId
			updatedAt
			jobProductRequirements {
				id
				name
				quantity
				unitPrice
				lineTotal
				warehouseCoreProductId
				warehouseProduct { id warehouseId }
			}
		}
	}`
	const findManyLegacyQ = `query {
		findManyOpportunities {
			id
			warehouseCoreJobId
			updatedAt
			jobProductRequirements {
				id
				name
				quantity
				unitPrice
				lineTotal
				warehouseCoreProductId
			}
		}
	}`
	const connectionWithRelationQ = `query {
		opportunities {
			edges {
				node {
					id
					warehouseCoreJobId
					updatedAt
					jobProductRequirements {
						id
						name
						quantity
						unitPrice
						lineTotal
						warehouseCoreProductId
						warehouseProduct { id warehouseId }
					}
				}
			}
		}
	}`
	const connectionLegacyQ = `query {
		opportunities {
			edges {
				node {
					id
					warehouseCoreJobId
					updatedAt
					jobProductRequirements {
						id
						name
						quantity
						unitPrice
						lineTotal
						warehouseCoreProductId
					}
				}
			}
		}
	}`

	var list []twentyOpportunityRequirementNode
	if err := doTwentyGraphQLRoot(ctx, findManyWithRelationQ, nil, "findManyOpportunities", &list); err != nil {
		if err2 := doTwentyGraphQLRoot(ctx, findManyLegacyQ, nil, "findManyOpportunities", &list); err2 != nil {
			var conn twentyOpportunityRequirementConnection
			if err3 := doTwentyGraphQLRoot(ctx, connectionWithRelationQ, nil, "opportunities", &conn); err3 != nil {
				if err4 := doTwentyGraphQLRoot(ctx, connectionLegacyQ, nil, "opportunities", &conn); err4 != nil {
					return nil, err4
				}
			}
			list = make([]twentyOpportunityRequirementNode, 0, len(conn.Edges))
			for _, e := range conn.Edges {
				list = append(list, e.Node)
			}
		}
	}

	var chosen *twentyOpportunityRequirementNode
	var chosenTS time.Time

	for _, opp := range list {
		if opp.WarehouseCoreJobID == nil || int(*opp.WarehouseCoreJobID) != jobID {
			continue
		}

		if chosen == nil {
			copyOpp := opp
			chosen = &copyOpp
			if opp.UpdatedAt != nil {
				if ts, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(*opp.UpdatedAt)); err == nil {
					chosenTS = ts
				}
			}
			continue
		}

		if opp.UpdatedAt == nil {
			continue
		}
		candidateTS, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(*opp.UpdatedAt))
		if err != nil {
			continue
		}
		if chosenTS.IsZero() || candidateTS.After(chosenTS) {
			copyOpp := opp
			chosen = &copyOpp
			chosenTS = candidateTS
		}
	}

	return chosen, nil
}

func updateTwentyRequirement(ctx context.Context, requirementID, name string, quantity float64, localProductID int, twentyProductID string, unitPrice float64, lineTotal float64) error {
	const updateOppLineQ = `mutation UpdateReq($id: UUID!, $name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		updateOpportunityRequirementLine(id: $id, data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			warehouseProductId: $warehouseProductId
		}) { id }
	}`

	const updateOneRelQ = `mutation UpdateReq($id: UUID!, $name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		updateOneJobProductRequirement(id: $id, data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			warehouseProduct: { connect: { id: $warehouseProductId } }
		}) { id }
	}`
	const updateRelQ = `mutation UpdateReq($id: UUID!, $name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		updateJobProductRequirement(id: $id, data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			warehouseProduct: { connect: { id: $warehouseProductId } }
		}) { id }
	}`
	const updateOneFkQ = `mutation UpdateReq($id: UUID!, $name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		updateOneJobProductRequirement(id: $id, data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			warehouseProductId: $warehouseProductId
		}) { id }
	}`
	const updateFkQ = `mutation UpdateReq($id: UUID!, $name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		updateJobProductRequirement(id: $id, data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			warehouseProductId: $warehouseProductId
		}) { id }
	}`

	vars := map[string]interface{}{
		"id":                     requirementID,
		"name":                   name,
		"quantity":               quantity,
		"warehouseCoreProductId": float64(localProductID),
		"warehouseProductId":     twentyProductID,
		"unitPrice":              unitPrice,
		"lineTotal":              lineTotal,
	}

	err := doTwentyGraphQLRoot(ctx, updateOppLineQ, vars, "updateOpportunityRequirementLine", nil)
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, updateOneRelQ, vars, "updateOneJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, updateRelQ, vars, "updateJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, updateOneFkQ, vars, "updateOneJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, updateFkQ, vars, "updateJobProductRequirement", nil)
	}
	return err
}

func createTwentyRequirement(ctx context.Context, opportunityID, name string, quantity float64, localProductID int, twentyProductID string, unitPrice float64, lineTotal float64) error {
	const createOppLineQ = `mutation CreateReq($name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $opportunityId: UUID!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		createOpportunityRequirementLine(data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			opportunityId: $opportunityId
			warehouseProductId: $warehouseProductId
		}) { id }
	}`

	const createOneRelQ = `mutation CreateReq($name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $opportunityId: UUID!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		createOneJobProductRequirement(data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			opportunity: { connect: { id: $opportunityId } }
			warehouseProduct: { connect: { id: $warehouseProductId } }
		}) { id }
	}`
	const createRelQ = `mutation CreateReq($name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $opportunityId: UUID!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		createJobProductRequirement(data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			opportunity: { connect: { id: $opportunityId } }
			warehouseProduct: { connect: { id: $warehouseProductId } }
		}) { id }
	}`
	const createOneFkQ = `mutation CreateReq($name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $opportunityId: UUID!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		createOneJobProductRequirement(data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			opportunityId: $opportunityId
			warehouseProductId: $warehouseProductId
		}) { id }
	}`
	const createFkQ = `mutation CreateReq($name: String!, $quantity: Float!, $warehouseCoreProductId: Float!, $opportunityId: UUID!, $warehouseProductId: UUID!, $unitPrice: Float!, $lineTotal: Float!) {
		createJobProductRequirement(data: {
			name: $name
			quantity: $quantity
			warehouseCoreProductId: $warehouseCoreProductId
			unitPrice: $unitPrice
			lineTotal: $lineTotal
			opportunityId: $opportunityId
			warehouseProductId: $warehouseProductId
		}) { id }
	}`

	vars := map[string]interface{}{
		"name":                   name,
		"quantity":               quantity,
		"warehouseCoreProductId": float64(localProductID),
		"opportunityId":          opportunityID,
		"warehouseProductId":     twentyProductID,
		"unitPrice":              unitPrice,
		"lineTotal":              lineTotal,
	}

	err := doTwentyGraphQLRoot(ctx, createOppLineQ, vars, "createOpportunityRequirementLine", nil)
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, createOneRelQ, vars, "createOneJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, createRelQ, vars, "createJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, createOneFkQ, vars, "createOneJobProductRequirement", nil)
	}
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, createFkQ, vars, "createJobProductRequirement", nil)
	}
	return err
}

func updateOpportunityEstimatedTotal(ctx context.Context, opp *twentyOpportunityRequirementNode) error {
	if opp == nil || strings.TrimSpace(opp.ID) == "" {
		return nil
	}

	const byIDQ = `query OpportunityByID($id: UUID!) {
		opportunity(id: $id) {
			id
			jobProductRequirements {
				quantity
				unitPrice
				lineTotal
			}
		}
	}`

	var fresh twentyOpportunityRequirementNode
	if err := doTwentyGraphQLRoot(ctx, byIDQ, map[string]interface{}{"id": opp.ID}, "opportunity", &fresh); err == nil {
		opp = &fresh
	}

	total := 0.0
	for _, line := range opp.JobRequirements {
		if line.LineTotal != nil {
			total += *line.LineTotal
			continue
		}
		if line.UnitPrice != nil && line.Quantity != nil {
			total += (*line.UnitPrice) * (*line.Quantity)
		}
	}

	const updateOneQ = `mutation UpdateOppTotal($id: UUID!, $total: Float!) {
		updateOneOpportunity(id: $id, data: { warehouseCoreEstimatedEquipmentTotal: $total }) {
			id
		}
	}`
	const updateQ = `mutation UpdateOppTotal($id: UUID!, $total: Float!) {
		updateOpportunity(id: $id, data: { warehouseCoreEstimatedEquipmentTotal: $total }) {
			id
		}
	}`
	vars := map[string]interface{}{
		"id":    opp.ID,
		"total": total,
	}
	err := doTwentyGraphQLRoot(ctx, updateOneQ, vars, "updateOneOpportunity", nil)
	if err != nil {
		err = doTwentyGraphQLRoot(ctx, updateQ, vars, "updateOpportunity", nil)
	}
	return err
}
