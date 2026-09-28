package admin

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/account"
)

const MaxBanReasonLength = 500

// Inviter creates accounts that finish signing up through an invite link.
type Inviter interface {
	Invite(ctx context.Context, email, name string, send bool) (*domain.User, string, bool, error)
	ReissueInvite(ctx context.Context, userID uuid.UUID, send bool) (string, bool, error)
}

// SessionRevoker signs a user out everywhere.
type SessionRevoker interface {
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
}

// Service lets admins manage the accounts of the instance. Callers check that
// the actor is an admin.
type Service struct {
	users    domain.AdminRepository
	sessions SessionRevoker
	inviter  Inviter
	now      func() time.Time
}

func NewService(users domain.AdminRepository, sessions SessionRevoker, inviter Inviter) *Service {
	return &Service{users: users, sessions: sessions, inviter: inviter, now: time.Now}
}

func (s *Service) ListUsers(ctx context.Context) ([]domain.AdminUser, error) {
	return s.users.ListUsers(ctx)
}

// Invite creates an account and returns the link where its owner chooses a
// password, emailing it when send is set.
func (s *Service) Invite(ctx context.Context, email, name string, send bool) (*domain.User, string, bool, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > account.MaxNameLength {
		return nil, "", false, &domain.ValidationError{Field: "name", Message: fmt.Sprintf("must be at most %d characters", account.MaxNameLength)}
	}
	return s.inviter.Invite(ctx, email, name, send)
}

// ReissueInvite replaces the invite link of a user who has not signed in yet.
func (s *Service) ReissueInvite(ctx context.Context, userID uuid.UUID, send bool) (string, bool, error) {
	return s.inviter.ReissueInvite(ctx, userID, send)
}

// Ban bars target from signing in and signs them out everywhere. They see
// reason when they try to sign in. Admins must be demoted first.
func (s *Service) Ban(ctx context.Context, actorID, targetID uuid.UUID, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return &domain.ValidationError{Field: "reason", Message: "tell them why"}
	}
	if utf8.RuneCountInString(reason) > MaxBanReasonLength {
		return &domain.ValidationError{Field: "reason", Message: fmt.Sprintf("must be at most %d characters", MaxBanReasonLength)}
	}
	u, err := s.other(ctx, actorID, targetID, "you cannot ban yourself")
	if err != nil {
		return err
	}
	if u.IsAdmin {
		return &domain.ValidationError{Field: "user", Message: "remove their admin role first"}
	}
	now := s.now()
	if err := s.users.SetBan(ctx, u.ID, &now, reason); err != nil {
		return err
	}
	return s.sessions.DeleteByUserID(ctx, u.ID)
}

// Unban lets target sign in again.
func (s *Service) Unban(ctx context.Context, targetID uuid.UUID) error {
	return s.users.SetBan(ctx, targetID, nil, "")
}

// SetAdmin grants or revokes the admin role of someone else. Admins cannot
// change their own role, so there is always at least one admin left.
func (s *Service) SetAdmin(ctx context.Context, actorID, targetID uuid.UUID, admin bool) error {
	u, err := s.other(ctx, actorID, targetID, "you cannot change your own role")
	if err != nil {
		return err
	}
	if admin && u.BannedAt != nil {
		return &domain.ValidationError{Field: "user", Message: "lift their ban first"}
	}
	return s.users.SetAdmin(ctx, u.ID, admin)
}

// other loads target, refusing when it is the actor.
func (s *Service) other(ctx context.Context, actorID, targetID uuid.UUID, self string) (*domain.User, error) {
	if actorID == targetID {
		return nil, &domain.ValidationError{Field: "user", Message: self}
	}
	return s.users.GetByID(ctx, targetID)
}
