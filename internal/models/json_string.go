package models

import (
	"bytes"
	"database/sql"
	"encoding/json"
)

// JSONString wraps sql.NullString but marshals to primitive JSON values.
type JSONString struct {
	sql.NullString
}

// MarshalJSON converts the value to a JSON string or null.
func (s JSONString) MarshalJSON() ([]byte, error) {
	if !s.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(s.String)
}

// UnmarshalJSON parses JSON string/null into the wrapper.
func (s *JSONString) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) || len(trimmed) == 0 {
		s.String = ""
		s.Valid = false
		return nil
	}

	if err := json.Unmarshal(trimmed, &s.String); err != nil {
		s.String = ""
		s.Valid = false
		return err
	}

	s.Valid = true
	return nil
}

// Ptr returns pointer to string when valid.
func (s JSONString) Ptr() *string {
	if !s.Valid {
		return nil
	}
	val := s.String
	return &val
}
