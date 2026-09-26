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
	// AvatarUpdatedAt is nil when the user has no uploaded avatar.
	AvatarUpdatedAt *time.Time
	CreatedAt       time.Time
}

// Avatar is a user-uploaded profile picture.
type Avatar struct {
	ContentType string
	Data        []byte
	UpdatedAt   time.Time
}

type UserRepository interface {
	Create(ctx context.Context, u *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
}

// UserDirectory looks users up on behalf of other users.
type UserDirectory interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetAvatar(ctx context.Context, id uuid.UUID) (*Avatar, error)
	// Search matches an exact email, or a name fragment among non-private users.
	Search(ctx context.Context, query string, exclude uuid.UUID, limit int) ([]User, error)
}

// AccountRepository manages the editable parts of a user's profile.
type AccountRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdateName(ctx context.Context, id uuid.UUID, name string) error
	UpdateVisibility(ctx context.Context, id uuid.UUID, v Visibility) error
	SetAvatar(ctx context.Context, id uuid.UUID, a *Avatar) error
	DeleteAvatar(ctx context.Context, id uuid.UUID) error
	GetAvatar(ctx context.Context, id uuid.UUID) (*Avatar, error)
}
