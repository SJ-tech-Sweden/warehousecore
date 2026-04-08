package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"hash/fnv"
	"strings"
)

// deviceIDLikeEscaper escapes SQL LIKE wildcard characters (\, %, _) so that
// a device ID prefix derived from user or DB input is treated as a literal
// string in a LIKE predicate.
var deviceIDLikeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// numericSuffixPattern is the PostgreSQL regular-expression used to test
// whether the suffix after the device ID prefix is a pure decimal integer.
const numericSuffixPattern = `^[0-9]+$`

// deviceIDLockNamespace is the fixed first key passed to
// pg_advisory_xact_lock(key1, key2). Using a two-key form ensures that
// device-ID allocation locks are in a distinct namespace and cannot
// accidentally collide with advisory locks taken by other subsystems.
const deviceIDLockNamespace int32 = 1

// DeriveDeviceIDPrefix returns the device ID prefix for a given product.
// If manualPrefix is non-empty it is returned verbatim (after trimming).
// Otherwise the prefix is derived from the product's subcategory abbreviation
// + pos_in_category (e.g. "LED1"). If no abbreviation is found the function
// falls back to "P{productID}" rather than raising an error, intentionally
// diverging from the DB trigger (migration 030) which raises in that case.
//
// The caller must hold an open transaction (tx).
func DeriveDeviceIDPrefix(ctx context.Context, tx *sql.Tx, productID int, manualPrefix string) (string, error) {
	if p := strings.TrimSpace(manualPrefix); p != "" {
		return p, nil
	}

	var abbreviation sql.NullString
	var posInCategory sql.NullInt64
	err := tx.QueryRowContext(ctx, `
		SELECT s.abbreviation, p.pos_in_category
		FROM products p
		LEFT JOIN subcategories s ON p.subcategoryID = s.subcategoryID
		WHERE p.productID = $1
	`, productID).Scan(&abbreviation, &posInCategory)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", fmt.Errorf("product %d not found", productID)
		}
		return "", fmt.Errorf("failed to fetch product info: %w", err)
	}

	if abbreviation.Valid && abbreviation.String != "" {
		posStr := "0"
		if posInCategory.Valid {
			posStr = fmt.Sprintf("%d", posInCategory.Int64)
		}
		return abbreviation.String + posStr, nil
	}
	return fmt.Sprintf("P%d", productID), nil
}

// AllocateDeviceCounter acquires a pg_advisory_xact_lock keyed on a
// per-namespace FNV-32a hash of the prefix to serialize concurrent allocation,
// then returns the next available numeric counter for device IDs that start
// with prefix.
//
// Locking uses the two-key form pg_advisory_xact_lock(key1, key2): key1 is a
// fixed namespace constant (deviceIDLockNamespace) that scopes these locks to
// device-ID allocation; key2 is a FNV-32a hash of the prefix so concurrent
// allocations for different prefixes do not block each other unnecessarily.
//
// The existing counter is found by scanning deviceIDs using a LIKE predicate
// with migration-037's varchar_pattern_ops index, which enables efficient
// prefix scans under any database collation. Wildcard characters (\, %, _) in
// the prefix are escaped before building the LIKE pattern so they are treated
// as literals. The numeric suffix after the prefix can be any length; counters
// above 999 are handled naturally.
//
// New IDs should be formatted with fmt.Sprintf("%s%03d", prefix, counter+i)
// to preserve three-digit leading zeros for counters below 1000, matching
// the DB trigger's LPAD(..., 3, '0') behaviour.
//
// The caller must hold an open transaction (tx).
func AllocateDeviceCounter(ctx context.Context, tx *sql.Tx, prefix string) (int64, error) {
	// Two-key advisory lock: namespace key 1 scopes the lock family to
	// device-ID allocation; the FNV-32a hash of the prefix serializes
	// concurrent allocations that share the same prefix namespace without
	// blocking unrelated advisory-lock users or unrelated prefixes.
	h := fnv.New32a()
	h.Write([]byte(prefix))
	prefixKey := int32(h.Sum32())
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1, $2)`, deviceIDLockNamespace, prefixKey); err != nil {
		return 0, fmt.Errorf("failed to acquire device creation lock: %w", err)
	}

	// Build a LIKE pattern that treats the prefix as a literal string.
	// We escape \, %, and _ so they are not interpreted as wildcard characters
	// by PostgreSQL, then append % so the predicate matches any device ID that
	// starts with the prefix.
	// Migration 037 adds a varchar_pattern_ops index on devices(deviceID) so
	// PostgreSQL can use a btree prefix scan for this LIKE query regardless of
	// the database collation (plain btree indexes are not used for LIKE under
	// non-C locales without varchar_pattern_ops).
	escapedPrefix := deviceIDLikeEscaper.Replace(prefix)
	pattern := escapedPrefix + "%"

	var nextCounter int64
	err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(
			CASE
				WHEN SUBSTRING(deviceID FROM CHAR_LENGTH($1) + 1) ~ '`+numericSuffixPattern+`'
				THEN CAST(SUBSTRING(deviceID FROM CHAR_LENGTH($1) + 1) AS BIGINT)
				ELSE 0
			END
		), 0) + 1
		FROM devices
		WHERE deviceID LIKE $2 ESCAPE '\'
	`, prefix, pattern).Scan(&nextCounter)
	if err != nil {
		return 0, fmt.Errorf("failed to determine next device counter: %w", err)
	}
	return nextCounter, nil
}
