//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestPeakRepository(t *testing.T) {
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
	users, hikes, peaks := NewUserRepository(db), NewHikeRepository(db), NewPeakRepository(db)

	alice := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
	if err := users.Create(ctx, alice); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", alice.ID) })

	// Far out in the ocean so no real imported peak interferes.
	const lon, lat = -30.0, -40.0
	started := time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)
	h := &domain.Hike{
		ID: uuid.New(), UserID: alice.ID, Name: "Ridge", StartedAt: &started, CreatedAt: time.Now(),
		Segments: []domain.Segment{{{Lon: lon, Lat: lat}, {Lon: lon + 0.01, Lat: lat}}},
	}
	if err := hikes.Create(ctx, h); err != nil {
		t.Fatal(err)
	}
	// A planned route over the same peaks doesn't count as reaching them.
	planned := &domain.Hike{ID: uuid.New(), UserID: alice.ID, Name: "Plan", Planned: true, CreatedAt: time.Now(), Segments: h.Segments}
	if err := hikes.Create(ctx, planned); err != nil {
		t.Fatal(err)
	}

	ele := func(v float64) *float64 { return &v }
	ids := []int64{-1001, -1002, -1003}
	t.Cleanup(func() { db.Delete(&PeakModel{}, "id IN ?", ids) })
	// About 22 m and 33 m off the track, then 1.1 km off.
	err = peaks.Upsert(ctx, []domain.Peak{
		{ID: ids[0], Name: "Low", EleM: ele(900), Lon: lon + 0.005, Lat: lat + 0.0002},
		{ID: ids[1], Name: "High", EleM: ele(1200), Lon: lon + 0.002, Lat: lat - 0.0003},
		{ID: ids[2], Name: "Far", EleM: ele(2000), Lon: lon + 0.005, Lat: lat + 0.01},
	})
	if err != nil {
		t.Fatal(err)
	}
	// Upserting again updates in place.
	if err := peaks.Upsert(ctx, []domain.Peak{{ID: ids[0], Name: "Low renamed", EleM: ele(900), Lon: lon + 0.005, Lat: lat + 0.0002}}); err != nil {
		t.Fatal(err)
	}

	if on, _ := peaks.OnHike(ctx, planned.ID, 50); len(on) != 2 {
		t.Errorf("planned route passes %d peaks", len(on))
	}
	on, err := peaks.OnHike(ctx, h.ID, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(on) != 2 || on[0].Name != "High" || on[1].Name != "Low renamed" || on[1].Lon != lon+0.005 {
		t.Errorf("on hike = %+v", on)
	}

	mine, err := peaks.OfUser(ctx, alice.ID, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(mine) != 2 || mine[0].Peak.Name != "High" || len(mine[0].Visits) != 1 || mine[0].Visits[0].HikeID != h.ID {
		t.Errorf("of user = %+v", mine)
	}
	if got, _ := peaks.OfUser(ctx, uuid.New(), 50); len(got) != 0 {
		t.Errorf("stranger summits = %+v", got)
	}
}
