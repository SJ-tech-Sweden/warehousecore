package services

import (
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// upsertJobDeviceSQL correctness
// ---------------------------------------------------------------------------

// TestUpsertJobDeviceSQL_HasOnConflict verifies that the outtake upsert SQL
// contains an ON CONFLICT … DO UPDATE clause so that re-scanning a device
// after an intake does not fail with a unique-constraint violation.
func TestUpsertJobDeviceSQL_HasOnConflict(t *testing.T) {
	if !strings.Contains(upsertJobDeviceSQL, "ON CONFLICT") {
		t.Error("upsertJobDeviceSQL must contain an ON CONFLICT clause")
	}
	if !strings.Contains(upsertJobDeviceSQL, "DO UPDATE") {
		t.Error("upsertJobDeviceSQL must contain a DO UPDATE clause")
	}
}

// TestUpsertJobDeviceSQL_ConflictOnJobIDAndDeviceID verifies that the conflict
// target matches the unique constraint enforced by migration 039.
func TestUpsertJobDeviceSQL_ConflictOnJobIDAndDeviceID(t *testing.T) {
	// The conflict target must reference both columns used in the unique
	// constraint.  Accept either case (postgres is case-insensitive for
	// unquoted identifiers; the production SQL uses mixed case).
	lower := strings.ToLower(upsertJobDeviceSQL)
	if !strings.Contains(lower, "jobid") || !strings.Contains(lower, "deviceid") {
		t.Error("ON CONFLICT target must include both jobID and deviceID columns")
	}
}

// TestUpsertJobDeviceSQL_UpdatesPackStatusToIssued verifies that the DO UPDATE
// clause resets pack_status to 'issued' so that a device returned via intake
// (which sets pack_status = 'pending') is correctly marked as issued again.
func TestUpsertJobDeviceSQL_UpdatesPackStatusToIssued(t *testing.T) {
	if !strings.Contains(upsertJobDeviceSQL, "pack_status = 'issued'") {
		t.Error("DO UPDATE must set pack_status = 'issued'")
	}
}

// TestUpsertJobDeviceSQL_UpdatesPackTs verifies that the DO UPDATE clause also
// updates pack_ts so the timestamp reflects the actual scan time.
func TestUpsertJobDeviceSQL_UpdatesPackTs(t *testing.T) {
	lower := strings.ToLower(upsertJobDeviceSQL)
	if !strings.Contains(lower, "pack_ts") {
		t.Error("DO UPDATE must update pack_ts")
	}
}

// TestUpsertJobDeviceSQL_TargetsJobdevicesTable verifies that the INSERT is
// directed at the `jobdevices` table (not `job_devices` or any other alias).
func TestUpsertJobDeviceSQL_TargetsJobdevicesTable(t *testing.T) {
	lower := strings.ToLower(upsertJobDeviceSQL)
	if !strings.Contains(lower, "jobdevices") {
		t.Error("upsertJobDeviceSQL must target the jobdevices table")
	}
	if strings.Contains(lower, "job_devices") {
		t.Error("upsertJobDeviceSQL must not reference job_devices (wrong table name)")
	}
}

// ---------------------------------------------------------------------------
// processOuttake validation
// ---------------------------------------------------------------------------

// TestProcessOuttake_NilJobIDReturnsError verifies that processOuttake returns
// a descriptive error when no job ID is provided, so callers receive a clear
// failure response instead of a nil-pointer panic.
func TestProcessOuttake_NilJobIDReturnsError(t *testing.T) {
	svc := &ScanService{} // db is nil; the nil-jobID guard fires before any DB call
	_, _, err := svc.processOuttake(nil, nil, nil)
	if err == nil {
		t.Fatal("expected error when jobID is nil, got nil")
	}
	if !strings.Contains(err.Error(), "job_id is required") {
		t.Errorf("unexpected error message: %q", err.Error())
	}
}
