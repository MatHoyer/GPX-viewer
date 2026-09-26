package account

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers struct {
	users map[uuid.UUID]*domain.User
}

func newFake(ids ...uuid.UUID) *fakeUsers {
	f := &fakeUsers{users: map[uuid.UUID]*domain.User{}}
	for _, id := range ids {
		f.users[id] = &domain.User{ID: id, Email: "a@b.c"}
	}
	return f
}

func (f *fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := f.users[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) UpdateName(_ context.Context, id uuid.UUID, name string) error {
	u, ok := f.users[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.Name = name
	return nil
}

func (f *fakeUsers) UpdateVisibility(_ context.Context, id uuid.UUID, v domain.Visibility) error {
	u, ok := f.users[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.Visibility = v
	return nil
}

func TestUpdateName(t *testing.T) {
	id := uuid.New()
	svc := NewService(newFake(id))
	ctx := context.Background()

	u, err := svc.UpdateName(ctx, id, "  Alain  ")
	if err != nil {
		t.Fatal(err)
	}
	if u.Name != "Alain" {
		t.Fatalf("name = %q, want trimmed", u.Name)
	}

	if u, err = svc.UpdateName(ctx, id, ""); err != nil || u.Name != "" {
		t.Fatalf("clearing name: %v, %q", err, u.Name)
	}

	var ve *domain.ValidationError
	if _, err := svc.UpdateName(ctx, id, strings.Repeat("é", MaxNameLength+1)); !errors.As(err, &ve) {
		t.Fatalf("too long: got %v, want validation error", err)
	}
	if _, err := svc.UpdateName(ctx, uuid.New(), "x"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("unknown user: got %v", err)
	}
}

func TestUpdateVisibility(t *testing.T) {
	id := uuid.New()
	svc := NewService(newFake(id))
	ctx := context.Background()

	u, err := svc.UpdateVisibility(ctx, id, domain.VisibilityFriends)
	if err != nil || u.Visibility != domain.VisibilityFriends {
		t.Fatalf("user = %+v, %v", u, err)
	}
	var ve *domain.ValidationError
	if _, err := svc.UpdateVisibility(ctx, id, "everyone"); !errors.As(err, &ve) || ve.Field != "visibility" {
		t.Errorf("invalid visibility err = %v", err)
	}
}
