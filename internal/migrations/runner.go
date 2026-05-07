package migrations

import (
	"database/sql"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"unicode/utf8"
)

func isForwardMigrationFile(name string) bool {
	if !strings.HasSuffix(name, ".sql") {
		return false
	}
	lower := strings.ToLower(name)
	if strings.Contains(lower, ".down.") || strings.HasSuffix(lower, ".down.sql") {
		return false
	}
	return true
}

func ApplyMigrations(db *sql.DB, dir string) error {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return err
	}
	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && isForwardMigrationFile(f.Name()) {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles)

	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`); err != nil {
		return err
	}

	for _, name := range sqlFiles {
		var exists bool
		err := db.QueryRow("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name = $1)", name).Scan(&exists)
		if err != nil {
			return err
		}
		if exists {
			log.Printf("skipping already applied migration %s", name)
			continue
		}
		path := filepath.Join(dir, name)
		b, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		// Execute the file contents as a single Exec call. This avoids
		// fragile statement-splitting logic for complex dollar-quoted
		// or non-UTF8-containing files which could hang the parser.
		if len(b) > 0 {
			if _, err := db.Exec(string(b)); err != nil {
				return err
			}
		}
		if _, err := db.Exec("INSERT INTO schema_migrations (name) VALUES ($1)", name); err != nil {
			return err
		}
		log.Printf("applied migration %s", name)
	}
	return nil
}

// ApplySeeds applies all .sql files in a seeds directory (lexical order).
// If the directory does not exist, it's a no-op.
func ApplySeeds(db *sql.DB, dir string) error {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var sqlFiles []string
	for _, f := range files {
		if !f.IsDir() && isForwardMigrationFile(f.Name()) {
			sqlFiles = append(sqlFiles, f.Name())
		}
	}
	sort.Strings(sqlFiles)
	for _, name := range sqlFiles {
		path := filepath.Join(dir, name)
		b, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}
		if len(b) > 0 {
			if _, err := db.Exec(string(b)); err != nil {
				return err
			}
		}
		log.Printf("applied seed %s", name)
	}
	return nil
}

// splitSQLStatements splits SQL text into top-level statements by semicolon
// while ignoring semicolons inside single quotes, double quotes, and
// dollar-quoted ($$...$$ or $tag$...$tag$) blocks.
func splitSQLStatements(sql string) []string {
	var stmts []string
	var cur []rune
	inSingle := false
	inDouble := false
	var dollarTag string
	i := 0
	for i < len(sql) {
		r, size := utf8.DecodeRuneInString(sql[i:])
		// peek ahead for dollar-quote start
		if !inSingle && !inDouble && dollarTag == "" && r == '$' {
			// attempt to read $tag$
			j := i + 1
			for j < len(sql) {
				rr, _ := utf8.DecodeRuneInString(sql[j:])
				if rr == '$' {
					tag := sql[i : j+1] // includes both $
					// ensure tag matches pattern $[A-Za-z0-9_]*$
					ok := true
					for k := 1; k < len(tag)-1; k++ {
						ch := tag[k]
						if !(ch == '_' || (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
							ok = false
							break
						}
					}
					if ok {
						// start dollar-quote
						dollarTag = tag
						cur = append(cur, []rune(tag)...)
						i = j + 1
						continue
					}
				}
				j++
			}
		}

		// check for end of dollar-quote
		if dollarTag != "" {
			// does sql[i:] start with dollarTag?
			if strings.HasPrefix(sql[i:], dollarTag) {
				// append tag and consume
				for _, rr := range dollarTag {
					cur = append(cur, rr)
				}
				i += len(dollarTag)
				dollarTag = ""
				continue
			}
			// inside dollar block, copy rune
			cur = append(cur, r)
			i += size
			continue
		}

		if !inSingle && !inDouble && r == '\'' {
			inSingle = true
			cur = append(cur, r)
			i += size
			continue
		}
		if inSingle {
			// handle escaped single quotes by doubling
			if r == '\'' {
				// lookahead: if next rune is also single-quote, it's escaped
				if i+size < len(sql) {
					rn, _ := utf8.DecodeRuneInString(sql[i+size:])
					if rn == '\'' {
						// include both
						cur = append(cur, '\'', '\'')
						i += size * 2
						continue
					}
				}
				inSingle = false
			}
			cur = append(cur, r)
			i += size
			continue
		}
		if !inSingle && !inDouble && r == '"' {
			inDouble = true
			cur = append(cur, r)
			i += size
			continue
		}
		if inDouble {
			if r == '"' {
				inDouble = false
			}
			cur = append(cur, r)
			i += size
			continue
		}

		// top-level semicolon splits statements
		if r == ';' {
			cur = append(cur, r)
			stmts = append(stmts, strings.TrimSpace(string(cur)))
			cur = cur[:0]
			i += size
			continue
		}

		cur = append(cur, r)
		i += size
	}
	// leftover
	if len(cur) > 0 {
		stmts = append(stmts, strings.TrimSpace(string(cur)))
	}
	return stmts
}
