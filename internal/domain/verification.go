package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// EmailVerification is a pending email verification link. A user has at most
// one; only the hash of the token is stored.
type EmailVerification struct {
	TokenHash string
	UserID    uuid.UUID
	ExpiresAt time.Time
	CreatedAt time.Time
}

type EmailVerificationRepository interface {
	// Replace stores v, dropping any earlier verification of the same user.
	Replace(ctx context.Context, v *EmailVerification) error
	GetByUserID(ctx context.Context, userID uuid.UUID) (*EmailVerification, error)
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
	// Consume deletes and returns the verification, so a link works once.
	Consume(ctx context.Context, tokenHash string) (*EmailVerification, error)
	DeleteExpired(ctx context.Context, now time.Time) error
}

// Mailer sends plain-text emails.
type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
}
