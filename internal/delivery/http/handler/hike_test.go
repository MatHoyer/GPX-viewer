package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeAuth struct{ user *domain.User }

func (a fakeAuth) Authenticate(context.Context, string) (*domain.User, error) { return a.user, nil }

type exportService struct {
	HikeService
	hikes []domain.Hike
}

func (s exportService) Export(_ context.Context, _ uuid.UUID, fn func(*domain.Hike, []byte) error) error {
	for i := range s.hikes {
		if err := fn(&s.hikes[i], []byte("<gpx>"+s.hikes[i].Name+"</gpx>")); err != nil {
			return err
		}
	}
	return nil
}

func TestExport(t *testing.T) {
	day := time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)
	svc := exportService{hikes: []domain.Hike{
		{Name: "Lac Blanc", StartedAt: &day},
		{Name: "Lac Blanc", StartedAt: &day},
		{Name: "Lac Blanc (2)", StartedAt: &day},
		{Name: "a/b", CreatedAt: day},
	}}
	h := middleware.RequireAuth(fakeAuth{&domain.User{ID: uuid.New()}})(http.HandlerFunc(NewHikeHandler(svc, nil, nil, 1).Export))

	req := httptest.NewRequest(http.MethodGet, "/api/hikes/export", nil)
	req.AddCookie(&http.Cookie{Name: middleware.SessionCookie, Value: "x"})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/zip" {
		t.Fatalf("status %d, content type %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	zr, err := zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	if err != nil {
		t.Fatal(err)
	}
	want := []struct{ name, body string }{
		{"2026-07-01 Lac Blanc.gpx", "<gpx>Lac Blanc</gpx>"},
		{"2026-07-01 Lac Blanc (2).gpx", "<gpx>Lac Blanc</gpx>"},
		{"2026-07-01 Lac Blanc (2) (2).gpx", "<gpx>Lac Blanc (2)</gpx>"},
		{"a_b.gpx", "<gpx>a/b</gpx>"},
	}
	if len(zr.File) != len(want) {
		t.Fatalf("got %d files", len(zr.File))
	}
	for i, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(rc)
		rc.Close()
		if f.Name != want[i].name || string(body) != want[i].body {
			t.Errorf("file %d = %q %q", i, f.Name, body)
		}
		if !f.Modified.Equal(day) {
			t.Errorf("file %d modified = %v", i, f.Modified)
		}
	}
}
