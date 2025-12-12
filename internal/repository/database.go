// Package repository provides SQLite database connection for WarehouseCore
// Migration von MySQL zu SQLite mit modernc.org/sqlite (CGO-free)
package repository

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"warehousecore/config"
)

// Common errors
var (
	ErrNotFound = errors.New("not found")
)

// DB holds the database connection pool (sql.DB)
var DB *sql.DB

// GormDB holds the GORM database connection for auth and models
var GormDB *gorm.DB

// InitDatabase initializes the SQLite database connection
func InitDatabase(cfg *config.Config) error {
	// Stelle sicher, dass das Verzeichnis existiert
	dbPath := cfg.Database.Path
	if dbPath == "" {
		dbPath = "./data/warehousecore.db"
	}

	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	// SQLite DSN mit Pragmas
	dsn := buildSQLiteDSN(dbPath, cfg.Database.BusyTimeout)

	// Öffne sql.DB für direkte SQL-Queries
	// Verwende den modernc.org/sqlite Treiber
	sqlDB, err := sql.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// SQLite-optimierte Pool-Einstellungen
	// WICHTIG: SQLite unterstützt nur eine Write-Connection!
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(30 * time.Minute)

	// Test connection
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB = sqlDB
	log.Printf("SQLite database connection established: %s", dbPath)

	// Initialize GORM mit SQLite-Treiber
	gormDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		SkipDefaultTransaction:                   true,
		PrepareStmt:                              true,
		CreateBatchSize:                          100,
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize GORM: %w", err)
	}

	// Setze SQLite Pragmas für Performance
	if err := configurePragmas(gormDB); err != nil {
		return fmt.Errorf("failed to configure pragmas: %w", err)
	}

	GormDB = gormDB
	log.Println("GORM SQLite connection established successfully")

	return nil
}

// buildSQLiteDSN erstellt den SQLite Connection String
func buildSQLiteDSN(path string, busyTimeout int) string {
	// In-Memory Datenbank
	if path == ":memory:" {
		return "file::memory:?cache=shared"
	}

	// Default busy timeout
	if busyTimeout <= 0 {
		busyTimeout = 5000 // 5 Sekunden
	}

	return fmt.Sprintf("file:%s?_pragma=busy_timeout(%d)&_pragma=foreign_keys(1)",
		path,
		busyTimeout,
	)
}

// configurePragmas setzt wichtige SQLite Pragmas
func configurePragmas(db *gorm.DB) error {
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA cache_size = -64000", // 64MB
		"PRAGMA temp_store = MEMORY",
		"PRAGMA mmap_size = 268435456", // 256MB
	}

	for _, pragma := range pragmas {
		if err := db.Exec(pragma).Error; err != nil {
			return fmt.Errorf("failed to execute %s: %w", pragma, err)
		}
	}

	// Log aktuelle Einstellungen
	var journalMode string
	db.Raw("PRAGMA journal_mode").Scan(&journalMode)
	log.Printf("SQLite journal_mode: %s", journalMode)

	return nil
}

// CloseDatabase closes the database connection properly
func CloseDatabase() error {
	if GormDB != nil {
		sqlDB, _ := GormDB.DB()
		if sqlDB != nil {
			// WAL Checkpoint vor dem Schließen
			GormDB.Exec("PRAGMA wal_checkpoint(TRUNCATE)")
			// Optimize
			GormDB.Exec("PRAGMA optimize")
		}
	}
	if DB != nil {
		return DB.Close()
	}
	return nil
}

// GetDB returns the GORM database connection
func GetDB() *gorm.DB {
	return GormDB
}

// GetSQLDB returns the raw SQL database connection
func GetSQLDB() *sql.DB {
	return DB
}

// HashAPIKey creates a stable SHA-256 hex hash of an API key.
func HashAPIKey(key string) string {
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}

// Checkpoint führt einen WAL-Checkpoint durch
func Checkpoint() error {
	if GormDB == nil {
		return errors.New("database not initialized")
	}
	return GormDB.Exec("PRAGMA wal_checkpoint(TRUNCATE)").Error
}

// Vacuum optimiert die Datenbank
func Vacuum() error {
	if GormDB == nil {
		return errors.New("database not initialized")
	}
	return GormDB.Exec("VACUUM").Error
}

// IntegrityCheck führt eine Integritätsprüfung durch
func IntegrityCheck() ([]string, error) {
	if GormDB == nil {
		return nil, errors.New("database not initialized")
	}

	var results []string
	rows, err := GormDB.Raw("PRAGMA integrity_check").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var result string
		if err := rows.Scan(&result); err != nil {
			return nil, err
		}
		results = append(results, result)
	}
	return results, nil
}
