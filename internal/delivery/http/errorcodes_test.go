package http

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// The web app shows API errors in the user's language by their code, so every
// code the server sends needs a translation under "errors" in each catalog.
func TestErrorCodesAreTranslated(t *testing.T) {
	codePattern := regexp.MustCompile(`Code:\s+"(\w+)"|res\.Code = "(\w+)"|"code":\s+"(\w+)"|}\{l\.message, "(\w+)"`)
	codes := map[string]string{}
	err := filepath.WalkDir("../../..", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() && (d.Name() == "web" || d.Name() == ".git" || d.Name() == "node_modules") {
			return filepath.SkipDir
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		src, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for _, m := range codePattern.FindAllStringSubmatch(string(src), -1) {
			for _, c := range m[1:] {
				if c != "" {
					codes[c] = path
				}
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(codes) < 10 {
		t.Fatalf("found only %d error codes; is the pattern still right?", len(codes))
	}

	for _, lang := range []string{"en", "fr"} {
		raw, err := os.ReadFile("../../../web/src/locales/" + lang + ".json")
		if err != nil {
			t.Fatal(err)
		}
		var catalog struct {
			Errors map[string]string `json:"errors"`
		}
		if err := json.Unmarshal(raw, &catalog); err != nil {
			t.Fatal(err)
		}
		for code, path := range codes {
			if _, ok := catalog.Errors[code]; !ok {
				t.Errorf("%s.json has no errors.%s (sent from %s)", lang, code, path)
			}
		}
	}
}
