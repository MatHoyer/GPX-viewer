package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers struct{ byID map[uuid.UUID]*domain.User }

func (f *fakeUsers) Create(_ context.Context, u *domain.User) error {
	for _, e := range f.byID {
		if e.Email == u.Email {
			return domain.ErrEmailTaken
		}
	}
	f.byID[u.ID] = u
	return nil
}

func (f *fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := f.byID[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range f.byID {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

type fakeSessions struct{ byHash map[string]*domain.Session }

func (f *fakeSessions) Create(_ context.Context, s *domain.Session) error {
	f.byHash[s.TokenHash] = s
	return nil
}

func (f *fakeSessions) GetByTokenHash(_ context.Context, h string) (*domain.Session, error) {
	if s, ok := f.byHash[h]; ok {
		return s, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeSessions) Delete(_ context.Context, h string) error {
	delete(f.byHash, h)
	return nil
}

func (f *fakeSessions) DeleteExpired(_ context.Context, now time.Time) error {
	for h, s := range f.byHash {
		if !now.Before(s.ExpiresAt) {
			delete(f.byHash, h)
		}
	}
	return nil
}

// plainHasher avoids bcrypt cost in tests.
type plainHasher struct{}

func (plainHasher) Hash(p string) (string, error) { return "h:" + p, nil }
func (plainHasher) Compare(h, p string) error {
	if h != "h:"+p {
		return errors.New("mismatch")
	}
	return nil
}

func newTestService(t *testing.T) (*Service, *fakeSessions) {
	t.Helper()
	sessions := &fakeSessions{byHash: map[string]*domain.Session{}}
	svc, err := NewService(&fakeUsers{byID: map[uuid.UUID]*domain.User{}}, sessions, plainHasher{}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return svc, sessions
}

func TestRegisterLoginAuthenticateLogout(t *testing.T) {
	ctx := context.Background()
	svc, sessions := newTestService(t)

	u, err := svc.Register(ctx, "  Alice@Example.com ", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != "alice@example.com" {
		t.Errorf("email not normalized: %q", u.Email)
	}

	token, _, err := svc.Login(ctx, "ALICE@example.com", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := sessions.byHash[token]; ok {
		t.Error("raw token must not be stored")
	}

	got, err := svc.Authenticate(ctx, token)
	if err != nil || got.ID != u.ID {
		t.Fatalf("authenticate: %v, %v", got, err)
	}

	if err := svc.Logout(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("after logout err = %v", err)
	}
}

func TestRegisterValidation(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService(t)

	var ve *domain.ValidationError
	if _, err := svc.Register(ctx, "not-an-email", "password123"); !errors.As(err, &ve) || ve.Field != "email" {
		t.Errorf("bad email err = %v", err)
	}
	if _, err := svc.Register(ctx, "a@b.co", "short"); !errors.As(err, &ve) || ve.Field != "password" {
		t.Errorf("short password err = %v", err)
	}
	if _, err := svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Register(ctx, "A@b.co", "password123"); !errors.Is(err, domain.ErrEmailTaken) {
		t.Errorf("duplicate err = %v", err)
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService(t)
	if _, err := svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.Login(ctx, "a@b.co", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("wrong password err = %v", err)
	}
	if _, _, err := svc.Login(ctx, "nobody@b.co", "password123"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("unknown user err = %v", err)
	}
}

func TestAuthenticateExpired(t *testing.T) {
	ctx := context.Background()
	svc, sessions := newTestService(t)
	if _, err := svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	token, _, err := svc.Login(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	svc.now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expired err = %v", err)
	}
	if len(sessions.byHash) != 0 {
		t.Error("expired session should be deleted")
	}
}
