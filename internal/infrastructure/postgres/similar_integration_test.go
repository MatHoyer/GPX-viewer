//go:build integration

package postgres

import (
	"context"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestListSimilar(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	users, hikes := NewUserRepository(db), NewHikeRepository(db)

	alice := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
	if err := users.Create(ctx, alice); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", alice.ID) })

	// A diagonal route of about 2.7 km through three points.
	route := func(dLon float64, reverse bool, via *domain.Point) domain.Segment {
		seg := domain.Segment{{Lon: 6.80 + dLon, Lat: 45.90}, {Lon: 6.81 + dLon, Lat: 45.91}, {Lon: 6.82 + dLon, Lat: 45.92}}
		if via != nil {
			seg[1] = *via
		}
		if reverse {
			slices.Reverse(seg)
		}
		return seg
	}
	add := func(name string, seg domain.Segment) uuid.UUID {
		h := &domain.Hike{ID: uuid.New(), UserID: alice.ID, Name: name, DistanceM: 2700, Segments: []domain.Segment{seg}, CreatedAt: time.Now()}
		h.Bounds = domain.Bounds{MinLon: 180, MinLat: 90, MaxLon: -180, MaxLat: -90}
		for _, p := range seg {
			h.Bounds.MinLon, h.Bounds.MaxLon = min(h.Bounds.MinLon, p.Lon), max(h.Bounds.MaxLon, p.Lon)
			h.Bounds.MinLat, h.Bounds.MaxLat = min(h.Bounds.MinLat, p.Lat), max(h.Bounds.MaxLat, p.Lat)
		}
		if err := hikes.Create(ctx, h); err != nil {
			t.Fatal(err)
		}
		return h.ID
	}
	base := add("base", route(0, false, nil))
	shifted := add("shifted ~40 m", route(0.0005, false, nil))
	reversed := add("reversed", route(0, true, nil))
	detour := add("detour ~1 km", route(0, false, &domain.Point{Lon: 6.823, Lat: 45.905}))
	add("elsewhere", route(0.1, false, nil))

	got, err := hikes.ListSimilar(ctx, alice.ID, base, 200)
	if err != nil {
		t.Fatal(err)
	}
	var ids []uuid.UUID
	for _, h := range got {
		ids = append(ids, h.ID)
	}
	if len(ids) != 2 || !slices.Contains(ids, shifted) || !slices.Contains(ids, reversed) || slices.Contains(ids, detour) {
		t.Errorf("similar to base = %v", got)
	}
	if got, _ := hikes.ListSimilar(ctx, uuid.New(), base, 200); len(got) != 0 {
		t.Errorf("stranger sees %d similar hikes", len(got))
	}
}
