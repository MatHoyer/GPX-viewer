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

func TestFriendshipRepository(t *testing.T) {
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
	friends := NewFriendshipRepository(db)

	newUser := func(name string, v domain.Visibility) uuid.UUID {
		u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", Name: name, PasswordHash: "x", Visibility: v, CreatedAt: time.Now()}
		if err := users.Create(ctx, u); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
		return u.ID
	}
	tag := uuid.NewString()[:8]
	alice := newUser("Alice "+tag, domain.VisibilityPublic)
	bob := newUser("Bob "+tag, domain.VisibilityPrivate)
	carol := newUser("Carol "+tag, domain.VisibilityFriends)

	if err := friends.Create(ctx, &domain.Friendship{RequesterID: alice, AddresseeID: bob, CreatedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}
	// The reverse request hits the unordered pair index.
	if err := friends.Create(ctx, &domain.Friendship{RequesterID: bob, AddresseeID: alice, CreatedAt: time.Now()}); !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("reverse request err = %v", err)
	}
	if err := friends.Create(ctx, &domain.Friendship{RequesterID: alice, AddresseeID: uuid.New(), CreatedAt: time.Now()}); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown user err = %v", err)
	}
	if err := friends.Create(ctx, &domain.Friendship{RequesterID: carol, AddresseeID: alice, CreatedAt: time.Now()}); err != nil {
		t.Fatal(err)
	}

	if err := friends.Accept(ctx, bob, alice, time.Now()); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("addressee accepting own request: err = %v", err)
	}
	if err := friends.Accept(ctx, alice, bob, time.Now()); err != nil {
		t.Fatal(err)
	}
	if f, err := friends.Get(ctx, bob, alice); err != nil || !f.Accepted || f.RequesterID != alice {
		t.Fatalf("get = %+v, %v", f, err)
	}

	cs, err := friends.ListConnections(ctx, alice)
	if err != nil {
		t.Fatal(err)
	}
	got := map[uuid.UUID]domain.Relation{}
	for _, c := range cs {
		got[c.User.ID] = c.Relation
	}
	if len(cs) != 2 || got[bob] != domain.RelationFriends || got[carol] != domain.RelationIncoming {
		t.Fatalf("connections = %+v", cs)
	}
	for _, c := range cs {
		if c.User.PasswordHash != "" {
			t.Error("connections load password hashes")
		}
	}

	if err := friends.Delete(ctx, bob, alice); err != nil {
		t.Fatal(err)
	}
	if _, err := friends.Get(ctx, alice, bob); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("after delete err = %v", err)
	}
}
