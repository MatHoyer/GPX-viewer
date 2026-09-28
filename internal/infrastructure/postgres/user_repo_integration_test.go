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

func TestUserRepositoryAccount(t *testing.T) {
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

	u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
	if err := users.Create(ctx, u); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })

	if err := users.UpdateName(ctx, u.ID, "Alain"); err != nil {
		t.Fatal(err)
	}
	if err := users.UpdateName(ctx, uuid.New(), "x"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown user: got %v", err)
	}

	if err := users.UpdateVisibility(ctx, u.ID, domain.VisibilityFriends); err != nil {
		t.Fatal(err)
	}
	got, err := users.GetByID(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Alain" || got.Visibility != domain.VisibilityFriends {
		t.Fatalf("user = %+v", got)
	}
}

// Deleting a user takes everything tied to them along, and nothing of others.
func TestUserRepositoryDelete(t *testing.T) {
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
	now := time.Now()

	newUser := func() uuid.UUID {
		u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: now}
		if err := users.Create(ctx, u); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
		return u.ID
	}
	newHike := func(owner uuid.UUID) uuid.UUID {
		h := &domain.Hike{ID: uuid.New(), UserID: owner, Name: "Hike", Labels: []string{"alps"}, CreatedAt: now,
			Segments: []domain.Segment{{{Lon: 6, Lat: 45}, {Lon: 6.01, Lat: 45.01}}}}
		if err := hikes.Create(ctx, h); err != nil {
			t.Fatal(err)
		}
		return h.ID
	}
	alice, bob := newUser(), newUser()
	aliceHike, bobHike := newHike(alice), newHike(bob)

	rows := []any{
		&SessionModel{TokenHash: uuid.NewString(), UserID: alice, ExpiresAt: now.Add(time.Hour), CreatedAt: now},
		&FriendshipModel{RequesterID: alice, AddresseeID: bob, CreatedAt: now, AcceptedAt: &now},
		&HikeParticipantModel{HikeID: bobHike, UserID: alice, CreatedAt: now},
		&HikeParticipantModel{HikeID: aliceHike, UserID: bob, CreatedAt: now},
		&HikeKudosModel{HikeID: bobHike, UserID: alice, CreatedAt: now},
		&HikeKudosModel{HikeID: aliceHike, UserID: bob, CreatedAt: now},
		&HikeCommentModel{ID: uuid.New(), HikeID: bobHike, UserID: alice, Body: "nice", CreatedAt: now},
		&HikeCommentModel{ID: uuid.New(), HikeID: aliceHike, UserID: bob, Body: "nice", CreatedAt: now},
	}
	for _, r := range rows {
		if err := db.Omit("Hike", "User", "Requester", "Addressee").Create(r).Error; err != nil {
			t.Fatal(err)
		}
	}

	if err := users.Delete(ctx, alice); err != nil {
		t.Fatal(err)
	}
	if err := users.Delete(ctx, alice); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("second delete err = %v", err)
	}

	count := func(query string, args ...any) int64 {
		var n int64
		if err := db.Raw(query, args...).Scan(&n).Error; err != nil {
			t.Fatal(err)
		}
		return n
	}
	for name, n := range map[string]int64{
		"hikes":        count("SELECT COUNT(*) FROM hikes WHERE user_id = ?", alice),
		"labels":       count("SELECT COUNT(*) FROM hike_labels WHERE hike_id = ?", aliceHike),
		"sessions":     count("SELECT COUNT(*) FROM sessions WHERE user_id = ?", alice),
		"friendships":  count("SELECT COUNT(*) FROM friendships WHERE requester_id = ? OR addressee_id = ?", alice, alice),
		"participants": count("SELECT COUNT(*) FROM hike_participants WHERE user_id = ? OR hike_id = ?", alice, aliceHike),
		"kudos":        count("SELECT COUNT(*) FROM hike_kudos WHERE user_id = ? OR hike_id = ?", alice, aliceHike),
		"comments":     count("SELECT COUNT(*) FROM hike_comments WHERE user_id = ? OR hike_id = ?", alice, aliceHike),
	} {
		if n != 0 {
			t.Errorf("%d %s left after delete", n, name)
		}
	}
	if n := count("SELECT COUNT(*) FROM hikes WHERE id = ?", bobHike); n != 1 {
		t.Error("bob's hike was deleted")
	}
}

func TestUserRepositoryAdmin(t *testing.T) {
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

	u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
	if err := users.Create(ctx, u); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })
	seen := time.Now().Add(-time.Minute).Truncate(time.Microsecond)
	if err := NewSessionRepository(db).Create(ctx, &domain.Session{TokenHash: uuid.NewString(), UserID: u.ID, ExpiresAt: time.Now().Add(time.Hour), CreatedAt: seen}); err != nil {
		t.Fatal(err)
	}

	if n, err := users.CountAdmins(ctx); err != nil || n == 0 {
		t.Errorf("admins = %d, %v; Migrate should promote the oldest user", n, err)
	}
	before, err := users.CountAdmins(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := users.SetAdmin(ctx, u.ID, true); err != nil {
		t.Fatal(err)
	}
	if n, err := users.CountAdmins(ctx); err != nil || n != before+1 {
		t.Errorf("admins after promote = %d, %v", n, err)
	}
	banned := time.Now().Truncate(time.Microsecond)
	if err := users.SetBan(ctx, u.ID, &banned, "spam"); err != nil {
		t.Fatal(err)
	}
	if err := users.SetBan(ctx, uuid.New(), nil, ""); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("unknown user err = %v", err)
	}

	list, err := users.ListUsers(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var got *domain.AdminUser
	for i := range list {
		if list[i].ID == u.ID {
			got = &list[i]
		}
	}
	if got == nil {
		t.Fatal("user not listed")
	}
	if !got.IsAdmin || got.BannedAt == nil || !got.BannedAt.Equal(banned) || got.BanReason != "spam" || got.Email != u.Email {
		t.Errorf("listed user = %+v", got)
	}
	if got.Hikes != 0 || got.LastSeenAt == nil || !got.LastSeenAt.Equal(seen) {
		t.Errorf("hikes = %d, last seen = %v, want 0, %v", got.Hikes, got.LastSeenAt, seen)
	}

	if err := users.SetBan(ctx, u.ID, nil, ""); err != nil {
		t.Fatal(err)
	}
	if g, err := users.GetByID(ctx, u.ID); err != nil || g.BannedAt != nil || g.BanReason != "" {
		t.Errorf("after unban = %+v, %v", g, err)
	}
}
