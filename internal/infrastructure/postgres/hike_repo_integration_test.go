//go:build integration

package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Run with: TEST_DATABASE_URL=... go test -tags integration ./internal/infrastructure/postgres/
func TestHikeRepository(t *testing.T) {
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

	users := NewUserRepository(db)
	hikes := NewHikeRepository(db)

	newUser := func() uuid.UUID {
		u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
		if err := users.Create(ctx, u); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
		return u.ID
	}
	alice, bob := newUser(), newUser()

	h := &domain.Hike{
		ID:     uuid.New(),
		UserID: alice,
		Name:   "Test",
		Segments: []domain.Segment{
			{{Lon: 6.8, Lat: 45.9, Ele: 1000}, {Lon: 6.81, Lat: 45.91, Ele: 1100}},
			{{Lon: 6.82, Lat: 45.92, Ele: 1200}, {Lon: 6.83, Lat: 45.93, Ele: 1300}},
		},
		RawGPX:    []byte("<gpx/>"),
		CreatedAt: time.Now(),
	}
	if err := hikes.Create(ctx, h); err != nil {
		t.Fatal(err)
	}

	tracks, err := hikes.ListTracks(ctx, alice, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(tracks) != 1 || len(tracks[0].Segments) != 2 || tracks[0].Segments[1][1] != (domain.Point{Lon: 6.83, Lat: 45.93}) {
		t.Fatalf("tracks = %+v", tracks)
	}

	if list, _ := hikes.ListByUser(ctx, bob); len(list) != 0 {
		t.Errorf("bob sees %d hikes", len(list))
	}

	// Tagging twice is a no-op; tagged hikes join the user's lists.
	for range 2 {
		if err := hikes.AddParticipant(ctx, h.ID, bob, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	if err := hikes.AddParticipant(ctx, h.ID, uuid.New(), time.Now()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("tag unknown user err = %v", err)
	}
	if ps, err := hikes.ListParticipants(ctx, h.ID); err != nil || len(ps) != 1 || ps[0].ID != bob || ps[0].PasswordHash != "" {
		t.Errorf("participants = %+v, %v", ps, err)
	}
	if list, _ := hikes.ListByUser(ctx, bob); len(list) != 1 || list[0].Owner == nil || list[0].Owner.ID != alice || list[0].Owner.PasswordHash != "" {
		t.Errorf("bob's list after tag = %+v", list)
	}
	if tracks, _ := hikes.ListTracks(ctx, bob, 0); len(tracks) != 1 {
		t.Errorf("bob's tracks have %d hikes after tag", len(tracks))
	}
	if err := hikes.RemoveParticipant(ctx, h.ID, bob); err != nil {
		t.Fatal(err)
	}
	if list, _ := hikes.ListByUser(ctx, bob); len(list) != 0 {
		t.Errorf("bob sees %d hikes after untag", len(list))
	}
	if _, err := hikes.GetByID(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob get err = %v", err)
	}
	if raw, err := hikes.GetRawGPX(ctx, alice, h.ID); err != nil || string(raw) != "<gpx/>" {
		t.Errorf("alice raw = %q, %v", raw, err)
	}
	if _, err := hikes.GetRawGPX(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob raw err = %v", err)
	}
	if err := hikes.Rename(ctx, bob, h.ID, "Stolen"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob rename err = %v", err)
	}
	if err := hikes.Rename(ctx, alice, h.ID, "Renamed"); err != nil {
		t.Errorf("alice rename err = %v", err)
	}
	if got, _ := hikes.GetByID(ctx, alice, h.ID); got == nil || got.Name != "Renamed" {
		t.Errorf("after rename = %+v", got)
	}
	if err := hikes.Delete(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob delete err = %v", err)
	}
	if err := hikes.Delete(ctx, alice, h.ID); err != nil {
		t.Errorf("alice delete err = %v", err)
	}
}
