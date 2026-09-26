package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID
	Email        string
	Name         string
	PasswordHash string
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

// AccountRepository manages the editable parts of a user's profile.
type AccountRepository interface {
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	UpdateName(ctx context.Context, id uuid.UUID, name string) error
	SetAvatar(ctx context.Context, id uuid.UUID, a *Avatar) error
	DeleteAvatar(ctx context.Context, id uuid.UUID) error
	GetAvatar(ctx context.Context, id uuid.UUID) (*Avatar, error)
}
