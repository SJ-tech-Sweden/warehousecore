package services

import (
	"os"
	"path/filepath"
	"testing"
)

// ===========================
// RemoveLabelFile tests
// ===========================

func TestRemoveLabelFile_EmptyPath(t *testing.T) {
	// Should be a no-op, no panic.
	RemoveLabelFile("")
}

func TestRemoveLabelFile_PathTraversal(t *testing.T) {
	// A path with ".." should be rejected (not remove any file).
	// Create a temp file outside of the label base dir to make sure it survives.
	tmpDir := t.TempDir()
	target := filepath.Join(tmpDir, "should-not-delete.txt")
	if err := os.WriteFile(target, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Try to traverse to the temp file — RemoveLabelFile must refuse.
	RemoveLabelFile("/../../../" + target)

	if _, err := os.Stat(target); os.IsNotExist(err) {
		t.Fatal("RemoveLabelFile deleted a file outside the base directory via path traversal")
	}
}

func TestRemoveLabelFile_NonExistentFile(t *testing.T) {
	// Should not panic when the file doesn't exist.
	RemoveLabelFile("/labels/nonexistent-device-label-file.pdf")
}

func TestRemoveLabelFile_ValidPath(t *testing.T) {
	// Use t.TempDir() as the label base directory to isolate filesystem side effects.
	tmpDir := t.TempDir()
	originalBaseDir := labelBaseDir
	labelBaseDir = tmpDir
	t.Cleanup(func() { labelBaseDir = originalBaseDir })

	labelsDir := filepath.Join(tmpDir, "labels")
	if err := os.MkdirAll(labelsDir, 0o755); err != nil {
		t.Fatal(err)
	}

	labelFile := filepath.Join(labelsDir, "test-device-label.pdf")
	if err := os.WriteFile(labelFile, []byte("label-data"), 0o644); err != nil {
		t.Fatal(err)
	}

	RemoveLabelFile("/labels/test-device-label.pdf")

	if _, err := os.Stat(labelFile); !os.IsNotExist(err) {
		t.Fatalf("expected label file to be removed, but it still exists")
	}
}
