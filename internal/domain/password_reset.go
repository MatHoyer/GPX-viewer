package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// PasswordReset is a pending password reset link. A user has at most one;
// only the hash of the token is stored.
type PasswordReset struct {
	TokenHash string
	UserID    uuid.UUID
	ExpiresAt time.Time
	CreatedAt time.Time
}

type PasswordResetRepository interface {
	// Replace stores p, dropping any earlier reset of the same user.
	Replace(ctx context.Context, p *PasswordReset) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*PasswordReset, error)
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
	// Consume deletes and returns the reset, so a link works once.
	Consume(ctx context.Context, tokenHash string) (*PasswordReset, error)
	DeleteExpired(ctx context.Context, now time.Time) error
}
