package account

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers struct {
	users   map[uuid.UUID]*domain.User
	avatars map[uuid.UUID]*domain.Avatar
}

func newFake(ids ...uuid.UUID) *fakeUsers {
	f := &fakeUsers{users: map[uuid.UUID]*domain.User{}, avatars: map[uuid.UUID]*domain.Avatar{}}
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

func (f *fakeUsers) SetAvatar(_ context.Context, id uuid.UUID, a *domain.Avatar) error {
	u, ok := f.users[id]
	if !ok {
		return domain.ErrNotFound
	}
	f.avatars[id] = a
	u.AvatarUpdatedAt = &a.UpdatedAt
	return nil
}

func (f *fakeUsers) DeleteAvatar(_ context.Context, id uuid.UUID) error {
	delete(f.avatars, id)
	if u, ok := f.users[id]; ok {
		u.AvatarUpdatedAt = nil
	}
	return nil
}

func (f *fakeUsers) GetAvatar(_ context.Context, id uuid.UUID) (*domain.Avatar, error) {
	if a, ok := f.avatars[id]; ok {
		return a, nil
	}
	return nil, domain.ErrNotFound
}

// Minimal PNG signature, enough for content sniffing.
var png = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")

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

func TestSetAvatar(t *testing.T) {
	id := uuid.New()
	fake := newFake(id)
	svc := NewService(fake)
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	svc.now = func() time.Time { return now }
	ctx := context.Background()

	u, err := svc.SetAvatar(ctx, id, png)
	if err != nil {
		t.Fatal(err)
	}
	if u.AvatarUpdatedAt == nil || !u.AvatarUpdatedAt.Equal(now) {
		t.Fatalf("AvatarUpdatedAt = %v, want %v", u.AvatarUpdatedAt, now)
	}
	a, err := svc.Avatar(ctx, id)
	if err != nil || a.ContentType != "image/png" {
		t.Fatalf("avatar = %+v, %v", a, err)
	}

	if u, err = svc.DeleteAvatar(ctx, id); err != nil || u.AvatarUpdatedAt != nil {
		t.Fatalf("delete: %v, %v", err, u.AvatarUpdatedAt)
	}
	if _, err := svc.Avatar(ctx, id); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("avatar after delete: %v", err)
	}
}

func TestSetAvatarRejectsInvalid(t *testing.T) {
	id := uuid.New()
	svc := NewService(newFake(id))
	ctx := context.Background()

	cases := map[string][]byte{
		"empty":   nil,
		"svg":     []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		"text":    []byte("hello"),
		"too big": append(append([]byte{}, png...), make([]byte, MaxAvatarBytes)...),
	}
	for name, data := range cases {
		var ve *domain.ValidationError
		if _, err := svc.SetAvatar(ctx, id, data); !errors.As(err, &ve) || ve.Field != "avatar" {
			t.Errorf("%s: got %v, want avatar validation error", name, err)
		}
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
