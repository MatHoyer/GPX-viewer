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
	CreatedAt       time.Time
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
