package migrations

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestApplyMigrations_RollsBackFailedMigration(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	dir := t.TempDir()
	name := "001_fail.sql"
	if err := os.WriteFile(filepath.Join(dir, name), []byte("ALTER TABLE test_table ADD COLUMN fail_col INTEGER;\nSELECT bad_syntax"), 0o644); err != nil {
		t.Fatalf("failed to write migration file: %v", err)
	}

	mock.ExpectExec(`CREATE TABLE IF NOT EXISTS schema_migrations`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM schema_migrations WHERE name = \$1\)`).
		WithArgs(name).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectBegin()
	mock.ExpectExec(`ALTER TABLE test_table ADD COLUMN fail_col INTEGER;`).
		WillReturnError(errors.New("boom"))
	mock.ExpectRollback()

	err = ApplyMigrations(db, dir)
	if err == nil {
		t.Fatalf("expected migration error, got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}

func TestApplyMigrations_SelfManagedTransactionExecutesWithoutWrapperTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	dir := t.TempDir()
	name := "001_self_tx.sql"
	sqlText := "BEGIN;\nSELECT 1;\nCOMMIT;\n"
	if err := os.WriteFile(filepath.Join(dir, name), []byte(sqlText), 0o644); err != nil {
		t.Fatalf("failed to write migration file: %v", err)
	}

	mock.ExpectExec(`CREATE TABLE IF NOT EXISTS schema_migrations`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM schema_migrations WHERE name = \$1\)`).
		WithArgs(name).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectExec(`BEGIN;`).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec(`INSERT INTO schema_migrations \(name\) VALUES \(\$1\)`).
		WithArgs(name).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := ApplyMigrations(db, dir); err != nil {
		t.Fatalf("unexpected migration error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sqlmock expectations: %v", err)
	}
}
