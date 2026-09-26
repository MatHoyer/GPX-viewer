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

func TestInteractionRepository(t *testing.T) {
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
	users, hikes, repo := NewUserRepository(db), NewHikeRepository(db), NewInteractionRepository(db)

	newUser := func() uuid.UUID {
		u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", Name: "Tester", PasswordHash: "x", CreatedAt: time.Now()}
		if err := users.Create(ctx, u); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
		return u.ID
	}
	alice, bob := newUser(), newUser()
	h := &domain.Hike{ID: uuid.New(), UserID: alice, Name: "Hike", CreatedAt: time.Now(),
		Segments: []domain.Segment{{{Lon: 6, Lat: 45}, {Lon: 6.01, Lat: 45.01}}}}
	if err := hikes.Create(ctx, h); err != nil {
		t.Fatal(err)
	}

	for range 2 {
		if err := repo.AddKudos(ctx, h.ID, bob, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	if err := repo.AddKudos(ctx, uuid.New(), bob, time.Now()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("kudos on missing hike err = %v", err)
	}
	for _, body := range []string{"first", "second"} {
		if err := repo.CreateComment(ctx, &domain.Comment{ID: uuid.New(), HikeID: h.ID, UserID: bob, Body: body, CreatedAt: time.Now()}); err != nil {
			t.Fatal(err)
		}
	}

	counts, err := repo.Counts(ctx, bob, []uuid.UUID{h.ID})
	if err != nil || counts[h.ID] != (domain.HikeInteractions{Kudos: 1, Comments: 2, Kudoed: true}) {
		t.Errorf("bob counts = %+v, %v", counts, err)
	}
	if counts, _ := repo.Counts(ctx, alice, []uuid.UUID{h.ID}); counts[h.ID].Kudoed {
		t.Error("alice kudoed her own hike")
	}

	comments, err := repo.ListComments(ctx, h.ID)
	if err != nil || len(comments) != 2 || comments[0].Body != "first" || comments[0].Author == nil || comments[0].Author.ID != bob || comments[0].Author.PasswordHash != "" {
		t.Fatalf("comments = %+v, %v", comments, err)
	}
	if _, err := repo.GetComment(ctx, uuid.New(), comments[0].ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("comment under another hike err = %v", err)
	}
	if err := repo.DeleteComment(ctx, comments[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := repo.RemoveKudos(ctx, h.ID, bob); err != nil {
		t.Fatal(err)
	}
	if counts, _ := repo.Counts(ctx, bob, []uuid.UUID{h.ID}); counts[h.ID] != (domain.HikeInteractions{Comments: 1}) {
		t.Errorf("after removals = %+v", counts)
	}

	// Deleting the hike takes its kudos and comments with it.
	if err := hikes.Delete(ctx, alice, h.ID); err != nil {
		t.Fatal(err)
	}
	var left int64
	db.Model(&HikeCommentModel{}).Where("hike_id = ?", h.ID).Count(&left)
	if left != 0 {
		t.Errorf("%d comments left after hike delete", left)
	}
}
