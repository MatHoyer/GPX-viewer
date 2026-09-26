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

func TestListFeed(t *testing.T) {
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
	users, hikes, friends := NewUserRepository(db), NewHikeRepository(db), NewFriendshipRepository(db)

	newUser := func(v domain.Visibility) uuid.UUID {
		u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", Visibility: v, CreatedAt: time.Now()}
		if err := users.Create(ctx, u); err != nil {
			t.Fatal(err)
		}
		if err := users.UpdateVisibility(ctx, u.ID, v); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
		return u.ID
	}
	me, sharing, private, stranger := newUser(domain.VisibilityPrivate), newUser(domain.VisibilityFriends), newUser(domain.VisibilityPrivate), newUser(domain.VisibilityPublic)
	for _, f := range []uuid.UUID{sharing, private} {
		if err := friends.Create(ctx, &domain.Friendship{RequesterID: f, AddresseeID: me, CreatedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
		if err := friends.Accept(ctx, f, me, time.Now()); err != nil {
			t.Fatal(err)
		}
	}

	day := func(d int) *time.Time { v := time.Date(2026, 7, d, 8, 0, 0, 0, time.UTC); return &v }
	add := func(owner uuid.UUID, name string, started *time.Time, planned bool) uuid.UUID {
		h := &domain.Hike{ID: uuid.New(), UserID: owner, Name: name, StartedAt: started, Planned: planned, CreatedAt: time.Now(),
			Segments: []domain.Segment{{{Lon: 6, Lat: 45}, {Lon: 6.01, Lat: 45.01}}}}
		if err := hikes.Create(ctx, h); err != nil {
			t.Fatal(err)
		}
		return h.ID
	}
	older := add(sharing, "friend, older", day(1), false)
	add(sharing, "friend, planned", day(9), true)
	newer := add(sharing, "friend, newer", day(5), false)
	add(private, "private friend", day(6), false)
	add(stranger, "stranger", day(7), false)
	tagged := add(stranger, "stranger tagged me", day(3), false)
	if err := hikes.AddParticipant(ctx, tagged, me, time.Now()); err != nil {
		t.Fatal(err)
	}
	add(me, "mine", day(8), false)

	page, err := hikes.ListFeed(ctx, me, nil, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(page) != 2 || page[0].ID != newer || page[1].ID != tagged || page[0].Owner == nil || len(page[1].Participants) != 1 {
		t.Fatalf("first page = %+v", page)
	}
	rest, err := hikes.ListFeed(ctx, me, &domain.FeedCursor{At: *page[1].StartedAt, ID: page[1].ID}, 2)
	if err != nil || len(rest) != 1 || rest[0].ID != older {
		t.Errorf("second page = %+v, %v", rest, err)
	}
}
