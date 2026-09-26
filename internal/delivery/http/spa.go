package http

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
)

// homeFile is the prerendered landing page, shown at / to signed-out visitors.
const homeFile = "home.html"

// spaHandler serves static files and falls back to index.html for client-side routes.
func spaHandler(static fs.FS) http.Handler {
	files := http.FileServerFS(static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if name == homeFile {
			http.Redirect(w, r, "/", http.StatusMovedPermanently)
			return
		}
		if _, err := fs.Stat(static, name); errors.Is(err, fs.ErrNotExist) {
			if path.Ext(name) != "" {
				http.NotFound(w, r)
				return
			}
			serveIndex(w, r, static)
			return
		}
		if strings.HasPrefix(name, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		if name == "index.html" {
			serveIndex(w, r, static)
			return
		}
		files.ServeHTTP(w, r)
	})
}

// rootHandler serves the app to signed-in users and the landing page to
// everyone else, falling back to the app when the frontend has no home page.
// Expects OptionalAuth in front of it.
func rootHandler(static fs.FS, appURL string) http.Handler {
	home, err := fs.ReadFile(static, homeFile)
	if err == nil {
		home = bytes.ReplaceAll(home, []byte("{{APP_URL}}"), []byte(strings.TrimRight(appURL, "/")))
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Vary", "Cookie")
		if home == nil || middleware.UserFrom(r.Context()) != nil {
			serveIndex(w, r, static)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(home)
	})
}

func robotsHandler(appURL string) http.HandlerFunc {
	body := fmt.Sprintf("User-agent: *\nDisallow: /api/\n\nSitemap: %s/sitemap.xml\n", strings.TrimRight(appURL, "/"))
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte(body))
	}
}

func sitemapHandler(appURL string) http.HandlerFunc {
	body := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>%s/</loc></url>
</urlset>
`, strings.TrimRight(appURL, "/"))
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		_, _ = w.Write([]byte(body))
	}
}

func serveIndex(w http.ResponseWriter, r *http.Request, static fs.FS) {
	b, err := fs.ReadFile(static, "index.html")
	if err != nil {
		http.Error(w, "frontend not built: run `make web`", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	_, _ = w.Write(b)
}
