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
