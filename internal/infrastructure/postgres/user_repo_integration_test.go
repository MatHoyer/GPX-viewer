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

	if _, err := users.GetAvatar(ctx, u.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("no avatar yet: got %v", err)
	}
	// Setting twice exercises the upsert.
	for _, data := range [][]byte{[]byte("first"), []byte("second")} {
		a := &domain.Avatar{ContentType: "image/png", Data: data, UpdatedAt: time.Now().Truncate(time.Microsecond)}
		if err := users.SetAvatar(ctx, u.ID, a); err != nil {
			t.Fatal(err)
		}
	}
	a, err := users.GetAvatar(ctx, u.ID)
	if err != nil || string(a.Data) != "second" {
		t.Fatalf("avatar = %+v, %v", a, err)
	}
	got, err := users.GetByID(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Alain" || got.AvatarUpdatedAt == nil || !got.AvatarUpdatedAt.Equal(a.UpdatedAt) {
		t.Fatalf("user = %+v", got)
	}

	if err := users.DeleteAvatar(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if got, _ = users.GetByID(ctx, u.ID); got.AvatarUpdatedAt != nil {
		t.Fatal("AvatarUpdatedAt not cleared")
	}
	if _, err := users.GetAvatar(ctx, u.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("avatar after delete: got %v", err)
	}
}
