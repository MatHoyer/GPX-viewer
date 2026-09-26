package http

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// publicHikes shows anonymous viewers only the hikes it holds.
type publicHikes map[uuid.UUID]*domain.Hike

func (p publicHikes) Get(_ context.Context, viewer, id uuid.UUID) (*domain.Hike, error) {
	if h, ok := p[id]; ok && viewer == uuid.Nil {
		return h, nil
	}
	return nil, domain.ErrNotFound
}

func TestHikePageMeta(t *testing.T) {
	started := time.Date(2026, 9, 20, 7, 0, 0, 0, time.UTC)
	public := &domain.Hike{ID: uuid.New(), Name: `Lac "Blanc" <3`, DistanceM: 12345, ElevationGainM: 850, StartedAt: &started, Owner: &domain.User{Name: "Ana"}}
	h := NewRouter(Deps{
		Authenticator: tokenAuth("good"),
		AppURL:        "https://hikes.example/",
		Static:        fstest.MapFS{"index.html": {Data: []byte("<html><head><title>GPX Viewer</title></head><body>app</body></html>")}},
		HikeMeta:      publicHikes{public.ID: public},
	})

	rec := get(h, "/hikes/"+public.ID.String(), "")
	body, _ := io.ReadAll(rec.Body)
	page := string(body)
	if rec.Code != http.StatusOK || !strings.Contains(page, "app") {
		t.Fatalf("status %d, body %q", rec.Code, page)
	}
	for _, want := range []string{
		`<title>Lac &#34;Blanc&#34; &lt;3 · GPX Viewer</title>`,
		`<meta property="og:title" content="Lac &#34;Blanc&#34; &lt;3" />`,
		`content="12.3 km · 850 m D+ · September 20, 2026 · by Ana"`,
		`<meta property="og:image" content="https://hikes.example/api/hikes/` + public.ID.String() + `/card.png" />`,
		`<link rel="canonical" href="https://hikes.example/hikes/` + public.ID.String() + `" />`,
	} {
		if !strings.Contains(page, want) {
			t.Errorf("page lacks %s\n%s", want, page)
		}
	}

	for _, path := range []string{"/hikes/" + uuid.NewString(), "/hikes/not-an-id"} {
		body, _ := io.ReadAll(get(h, path, "").Body)
		if strings.Contains(string(body), "og:") || !strings.Contains(string(body), "<title>GPX Viewer</title>") {
			t.Errorf("%s leaks preview tags: %s", path, body)
		}
	}
}
