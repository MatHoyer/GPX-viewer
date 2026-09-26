package http

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"html"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
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

// HikeMeta finds a hike for its page's link preview.
type HikeMeta interface {
	Get(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, error)
}

// hikePageHandler serves the app for /hikes/{id}, with a title and Open Graph
// tags describing the hike when anyone may see it. Link unfurlers don't run
// JavaScript, so this is what they show. Private hikes get the plain page.
func hikePageHandler(static fs.FS, appURL string, hikes HikeMeta) http.HandlerFunc {
	base := strings.TrimRight(appURL, "/")
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			serveIndex(w, r, static)
			return
		}
		h, err := hikes.Get(r.Context(), uuid.Nil, id)
		if err != nil {
			serveIndex(w, r, static)
			return
		}
		page, err := fs.ReadFile(static, "index.html")
		if err != nil {
			serveIndex(w, r, static)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		_, _ = w.Write(withHikeMeta(page, h, base))
	}
}

// withHikeMeta replaces the page title and adds preview tags before </head>.
func withHikeMeta(page []byte, h *domain.Hike, base string) []byte {
	desc := fmt.Sprintf("%.1f km · %d m D+", h.DistanceM/1000, int(h.ElevationGainM+0.5))
	if h.StartedAt != nil {
		desc += " · " + h.StartedAt.Format("January 2, 2006")
	}
	if h.Owner != nil && h.Owner.Name != "" {
		desc += " · by " + h.Owner.Name
	}
	title := html.EscapeString(h.Name)
	url := html.EscapeString(base + "/hikes/" + h.ID.String())
	image := html.EscapeString(base + "/api/hikes/" + h.ID.String() + "/card.png")
	desc = html.EscapeString(desc)
	tags := fmt.Sprintf(`<meta name="description" content="%[2]s" />
    <link rel="canonical" href="%[3]s" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="GPX Viewer" />
    <meta property="og:title" content="%[1]s" />
    <meta property="og:description" content="%[2]s" />
    <meta property="og:url" content="%[3]s" />
    <meta property="og:image" content="%[4]s" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>`, title, desc, url, image)
	page = bytes.Replace(page, []byte("<title>GPX Viewer</title>"), []byte("<title>"+title+" · GPX Viewer</title>"), 1)
	return bytes.Replace(page, []byte("</head>"), []byte(tags), 1)
}
