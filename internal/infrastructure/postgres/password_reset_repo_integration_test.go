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

func TestPasswordResetRepository(t *testing.T) {
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
	repo := NewPasswordResetRepository(db)

	now := time.Now().UTC().Truncate(time.Microsecond)
	u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", Visibility: domain.VisibilityPrivate, CreatedAt: now}
	if err := users.Create(ctx, u); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })

	first := &domain.PasswordReset{TokenHash: uuid.NewString(), UserID: u.ID, ExpiresAt: now.Add(time.Hour), CreatedAt: now}
	if err := repo.Replace(ctx, first); err != nil {
		t.Fatal(err)
	}
	second := &domain.PasswordReset{TokenHash: uuid.NewString(), UserID: u.ID, ExpiresAt: now.Add(2 * time.Hour), CreatedAt: now.Add(time.Minute)}
	if err := repo.Replace(ctx, second); err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetByUserID(ctx, u.ID)
	if err != nil || got.TokenHash != second.TokenHash || !got.CreatedAt.Equal(second.CreatedAt) {
		t.Fatalf("after replace: %+v, %v", got, err)
	}

	if _, err := repo.Consume(ctx, first.TokenHash); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("replaced token: got %v", err)
	}
	got, err = repo.Consume(ctx, second.TokenHash)
	if err != nil || got.UserID != u.ID || !got.ExpiresAt.Equal(second.ExpiresAt) {
		t.Fatalf("consume: %+v, %v", got, err)
	}
	if _, err := repo.Consume(ctx, second.TokenHash); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("second consume: got %v", err)
	}

	expired := &domain.PasswordReset{TokenHash: uuid.NewString(), UserID: u.ID, ExpiresAt: now.Add(-time.Minute), CreatedAt: now}
	if err := repo.Replace(ctx, expired); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteExpired(ctx, now); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetByUserID(ctx, u.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("after purge: got %v", err)
	}

	if err := repo.Replace(ctx, first); err != nil {
		t.Fatal(err)
	}
	if err := repo.DeleteByUserID(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetByUserID(ctx, u.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("after delete: got %v", err)
	}

	if err := users.UpdatePassword(ctx, u.ID, "new-hash"); err != nil {
		t.Fatal(err)
	}
	if got, err := users.GetByID(ctx, u.ID); err != nil || got.PasswordHash != "new-hash" {
		t.Fatalf("updated password: %+v, %v", got, err)
	}
	if err := users.UpdatePassword(ctx, uuid.New(), "x"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("unknown user: got %v", err)
	}

	sessions := NewSessionRepository(db)
	var hashes []string
	for range 2 {
		s := &domain.Session{TokenHash: uuid.NewString(), UserID: u.ID, ExpiresAt: now.Add(time.Hour), CreatedAt: now}
		if err := sessions.Create(ctx, s); err != nil {
			t.Fatal(err)
		}
		hashes = append(hashes, s.TokenHash)
	}
	if err := sessions.DeleteByUserID(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	for _, h := range hashes {
		if _, err := sessions.GetByTokenHash(ctx, h); !errors.Is(err, domain.ErrNotFound) {
			t.Errorf("session survived: %v", err)
		}
	}
}
