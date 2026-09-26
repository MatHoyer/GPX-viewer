package http

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type tokenAuth string

func (a tokenAuth) Authenticate(_ context.Context, token string) (*domain.User, error) {
	if token != string(a) {
		return nil, domain.ErrUnauthorized
	}
	return &domain.User{}, nil
}

func testRouter() http.Handler {
	return NewRouter(Deps{
		Authenticator: tokenAuth("good"),
		AppURL:        "https://hikes.example/",
		Static: fstest.MapFS{
			"index.html": {Data: []byte("app")},
			"home.html":  {Data: []byte(`home <link rel="canonical" href="{{APP_URL}}/">`)},
		},
	})
}

func get(h http.Handler, path, session string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if session != "" {
		req.AddCookie(&http.Cookie{Name: middleware.SessionCookie, Value: session})
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRootServesHomeToVisitors(t *testing.T) {
	h := testRouter()
	for _, session := range []string{"", "stale"} {
		rec := get(h, "/", session)
		body, _ := io.ReadAll(rec.Body)
		if rec.Code != http.StatusOK || !strings.HasPrefix(string(body), "home") {
			t.Fatalf("session %q: got %d %q, want the home page", session, rec.Code, body)
		}
		if !strings.Contains(string(body), `href="https://hikes.example/"`) {
			t.Errorf("APP_URL not substituted: %q", body)
		}
		if rec.Header().Get("Vary") != "Cookie" {
			t.Errorf("Vary = %q, want Cookie", rec.Header().Get("Vary"))
		}
	}
}

func TestRootServesAppToSignedInUsers(t *testing.T) {
	rec := get(testRouter(), "/", "good")
	if body := rec.Body.String(); rec.Code != http.StatusOK || body != "app" {
		t.Fatalf("got %d %q, want the app", rec.Code, body)
	}
}

func TestClientRoutesServeApp(t *testing.T) {
	rec := get(testRouter(), "/calendar", "")
	if body := rec.Body.String(); body != "app" {
		t.Fatalf("got %q, want the app", body)
	}
}

func TestHomeFileRedirectsToRoot(t *testing.T) {
	rec := get(testRouter(), "/home.html", "")
	if rec.Code != http.StatusMovedPermanently || rec.Header().Get("Location") != "/" {
		t.Fatalf("got %d to %q, want a redirect to /", rec.Code, rec.Header().Get("Location"))
	}
}

func TestSitemapAndRobots(t *testing.T) {
	h := testRouter()
	if body := get(h, "/sitemap.xml", "").Body.String(); !strings.Contains(body, "<loc>https://hikes.example/</loc>") {
		t.Errorf("sitemap: %q", body)
	}
	if body := get(h, "/robots.txt", "").Body.String(); !strings.Contains(body, "Sitemap: https://hikes.example/sitemap.xml") {
		t.Errorf("robots: %q", body)
	}
}
