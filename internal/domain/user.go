package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Visibility controls who can see a user's profile and hikes.
type Visibility string

const (
	VisibilityPrivate Visibility = "private"
	VisibilityFriends Visibility = "friends"
	VisibilityPublic  Visibility = "public"
)

func (v Visibility) Valid() bool {
	switch v {
	case VisibilityPrivate, VisibilityFriends, VisibilityPublic:
		return true
	}
	return false
}

type User struct {
	ID           uuid.UUID
	Email        string
	Name         string
	PasswordHash string
	Visibility   Visibility
	// EmailVerifiedAt is nil until the user follows the link sent to Email.
	EmailVerifiedAt *time.Time
	// IsAdmin grants access to the admin panel. The first account is an admin.
	IsAdmin bool
	// BannedAt is set while an admin bars the user from signing in, for
	// BanReason, which the user sees when they try.
	BannedAt  *time.Time
	BanReason string
	CreatedAt time.Time
}

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	MarkEmailVerified(ctx context.Context, id uuid.UUID, at time.Time) error
	UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error
	// Delete removes the user and, through cascading foreign keys, everything
	// tied to them: hikes, tags, friendships, kudos, comments and sessions.
	Delete(ctx context.Context, id uuid.UUID) error
	// Count returns how many accounts exist.
	Count(ctx context.Context) (int64, error)
	// CountAdmins returns how many accounts are admins.
	CountAdmins(ctx context.Context) (int64, error)
}

// AdminUser is a user as listed in the admin panel.
type AdminUser struct {
	User
	// Hikes counts the hikes they own.
	Hikes int64
	// LastSeenAt is when their most recent live session started.
	LastSeenAt *time.Time
}

// AdminRepository manages accounts on behalf of admins.
type AdminRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	ListUsers(ctx context.Context) ([]AdminUser, error)
	SetAdmin(ctx context.Context, id uuid.UUID, admin bool) error
	// SetBan bans the user when at is set, and lifts the ban when it is nil.
	SetBan(ctx context.Context, id uuid.UUID, at *time.Time, reason string) error
	// DeletePending deletes a user whose email is not verified and who owns
	// no hikes. It returns ErrConflict when the user no longer qualifies.
	DeletePending(ctx context.Context, id uuid.UUID) error
}

// UserDirectory looks users up on behalf of other users.
type UserDirectory interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
}

// AccountRepository manages the editable parts of a user's profile.
type AccountRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdateName(ctx context.Context, id uuid.UUID, name string) error
	UpdateVisibility(ctx context.Context, id uuid.UUID, v Visibility) error
}
