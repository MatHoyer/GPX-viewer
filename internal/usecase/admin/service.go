package admin

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/account"
)

const (
	MaxBanReasonLength = 500
	// PageSize is how many users a page of the list holds.
	PageSize = 20
	// maxQueryLength bounds the user search.
	maxQueryLength = 200
)

// Inviter creates accounts that finish signing up through an invite link.
type Inviter interface {
	Invite(ctx context.Context, email, name string, send bool) (*domain.User, string, bool, error)
	ReissueInvite(ctx context.Context, userID uuid.UUID, send bool) (string, bool, error)
}

// Sessions lists and revokes users' sessions.
type Sessions interface {
	ListByUserID(ctx context.Context, userID uuid.UUID, now time.Time) ([]domain.Session, error)
	DeleteByID(ctx context.Context, userID, id uuid.UUID) error
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
}

// Service lets admins manage the accounts of the instance. Callers check that
// the actor is an admin.
type Service struct {
	users    domain.AdminRepository
	sessions Sessions
	inviter  Inviter
	now      func() time.Time
}

func NewService(users domain.AdminRepository, sessions Sessions, inviter Inviter) *Service {
	return &Service{users: users, sessions: sessions, inviter: inviter, now: time.Now}
}

// UserPage is one page of the user list.
type UserPage struct {
	Users []domain.AdminUser
	// Total counts every user matching the query.
	Total int64
}

// ListUsers returns page (from 1) of the users whose email or name contains
// query, oldest first.
func (s *Service) ListUsers(ctx context.Context, query string, page int) (*UserPage, error) {
	query = strings.TrimSpace(query)
	if utf8.RuneCountInString(query) > maxQueryLength {
		return nil, &domain.ValidationError{Field: "q", Message: "search is too long"}
	}
	page = max(page, 1)
	users, total, err := s.users.ListUsers(ctx, query, PageSize, (page-1)*PageSize)
	if err != nil {
		return nil, err
	}
	return &UserPage{Users: users, Total: total}, nil
}

func (s *Service) GetUser(ctx context.Context, id uuid.UUID) (*domain.AdminUser, error) {
	return s.users.GetAdminUser(ctx, id)
}

// Sessions lists the user's live sessions, most recently used first.
func (s *Service) Sessions(ctx context.Context, userID uuid.UUID) ([]domain.Session, error) {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return nil, err
	}
	return s.sessions.ListByUserID(ctx, userID, s.now())
}

// RevokeSession signs the user out of one device.
func (s *Service) RevokeSession(ctx context.Context, userID, id uuid.UUID) error {
	return s.sessions.DeleteByID(ctx, userID, id)
}

// RevokeSessions signs the user out everywhere. Unlike a ban, they can sign
// in again.
func (s *Service) RevokeSessions(ctx context.Context, userID uuid.UUID) error {
	if _, err := s.users.GetByID(ctx, userID); err != nil {
		return err
	}
	return s.sessions.DeleteByUserID(ctx, userID)
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

// RevokeInvite cancels the invite of a user who has not accepted it yet by
// deleting their account, which also voids the link. The email can be
// invited again. Accounts that own hikes are kept.
func (s *Service) RevokeInvite(ctx context.Context, targetID uuid.UUID) error {
	u, err := s.users.GetByID(ctx, targetID)
	if err != nil {
		return err
	}
	if u.EmailVerifiedAt != nil {
		return &domain.ValidationError{Field: "user", Message: "they already accepted; ban them instead"}
	}
	err = s.users.DeletePending(ctx, u.ID)
	if errors.Is(err, domain.ErrConflict) {
		return &domain.ValidationError{Field: "user", Message: "this account has hikes; ban it instead"}
	}
	return err
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
