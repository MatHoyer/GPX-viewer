package admin

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers struct{ byID map[uuid.UUID]*domain.User }

func (f *fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := f.byID[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) ListUsers(context.Context) ([]domain.AdminUser, error) { return nil, nil }

func (f *fakeUsers) SetAdmin(_ context.Context, id uuid.UUID, admin bool) error {
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.IsAdmin = admin
	return nil
}

func (f *fakeUsers) SetBan(_ context.Context, id uuid.UUID, at *time.Time, reason string) error {
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.BannedAt, u.BanReason = at, reason
	return nil
}

func (f *fakeUsers) DeletePending(_ context.Context, id uuid.UUID) error {
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	if u.EmailVerifiedAt != nil || u.Name == "has hikes" {
		return domain.ErrConflict
	}
	delete(f.byID, id)
	return nil
}

type fakeSessions struct{ revoked []uuid.UUID }

func (f *fakeSessions) DeleteByUserID(_ context.Context, id uuid.UUID) error {
	f.revoked = append(f.revoked, id)
	return nil
}

type noInviter struct{}

func (noInviter) Invite(context.Context, string, string, bool) (*domain.User, string, bool, error) {
	return nil, "", false, errors.New("not called")
}

func (noInviter) ReissueInvite(context.Context, uuid.UUID, bool) (string, bool, error) {
	return "", false, errors.New("not called")
}

func setup() (*Service, *fakeSessions, *domain.User, *domain.User) {
	admin := &domain.User{ID: uuid.New(), IsAdmin: true}
	user := &domain.User{ID: uuid.New()}
	sessions := &fakeSessions{}
	users := &fakeUsers{byID: map[uuid.UUID]*domain.User{admin.ID: admin, user.ID: user}}
	return NewService(users, sessions, noInviter{}), sessions, admin, user
}

func TestBan(t *testing.T) {
	ctx := context.Background()
	svc, sessions, admin, user := setup()
	var ve *domain.ValidationError

	if err := svc.Ban(ctx, admin.ID, user.ID, "  "); !errors.As(err, &ve) || ve.Field != "reason" {
		t.Errorf("empty reason err = %v", err)
	}
	if err := svc.Ban(ctx, admin.ID, admin.ID, "spam"); !errors.As(err, &ve) {
		t.Errorf("self ban err = %v", err)
	}
	if err := svc.Ban(ctx, admin.ID, user.ID, " spam "); err != nil {
		t.Fatal(err)
	}
	if user.BannedAt == nil || user.BanReason != "spam" {
		t.Errorf("user = %+v", user)
	}
	if len(sessions.revoked) != 1 || sessions.revoked[0] != user.ID {
		t.Errorf("revoked = %v", sessions.revoked)
	}
	if err := svc.SetAdmin(ctx, admin.ID, user.ID, true); !errors.As(err, &ve) {
		t.Errorf("promote banned err = %v", err)
	}

	if err := svc.Unban(ctx, user.ID); err != nil {
		t.Fatal(err)
	}
	if user.BannedAt != nil || user.BanReason != "" {
		t.Errorf("after unban user = %+v", user)
	}
}

func TestBanAdminRefused(t *testing.T) {
	ctx := context.Background()
	svc, _, admin, user := setup()
	user.IsAdmin = true
	var ve *domain.ValidationError
	if err := svc.Ban(ctx, admin.ID, user.ID, "spam"); !errors.As(err, &ve) {
		t.Errorf("ban admin err = %v", err)
	}
}

func TestSetAdmin(t *testing.T) {
	ctx := context.Background()
	svc, _, admin, user := setup()
	var ve *domain.ValidationError

	if err := svc.SetAdmin(ctx, admin.ID, admin.ID, false); !errors.As(err, &ve) {
		t.Errorf("self demote err = %v", err)
	}
	if err := svc.SetAdmin(ctx, admin.ID, user.ID, true); err != nil || !user.IsAdmin {
		t.Fatalf("promote: %v, %v", user.IsAdmin, err)
	}
	if err := svc.SetAdmin(ctx, user.ID, admin.ID, false); err != nil || admin.IsAdmin {
		t.Fatalf("demote: %v, %v", admin.IsAdmin, err)
	}
	if err := svc.SetAdmin(ctx, user.ID, uuid.New(), true); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("unknown user err = %v", err)
	}
}

func TestRevokeInvite(t *testing.T) {
	ctx := context.Background()
	svc, _, admin, user := setup()
	var ve *domain.ValidationError

	now := time.Now()
	admin.EmailVerifiedAt = &now
	if err := svc.RevokeInvite(ctx, admin.ID); !errors.As(err, &ve) {
		t.Errorf("verified user err = %v", err)
	}
	user.Name = "has hikes"
	if err := svc.RevokeInvite(ctx, user.ID); !errors.As(err, &ve) {
		t.Errorf("user with hikes err = %v", err)
	}
	user.Name = ""
	if err := svc.RevokeInvite(ctx, user.ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.RevokeInvite(ctx, user.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("revoked twice err = %v", err)
	}
}
