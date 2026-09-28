package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Session is a server-side login session. Only the hash of the token is stored.
type Session struct {
	// ID names the session to its owner and admins; unlike the token, it
	// grants nothing.
	ID        uuid.UUID
	TokenHash string
	UserID    uuid.UUID
	// UserAgent and IP are those of the client that signed in; IP follows
	// the client as the session is used.
	UserAgent  string
	IP         string
	ExpiresAt  time.Time
	LastUsedAt time.Time
	CreatedAt  time.Time
}

type SessionRepository interface {
	Create(ctx context.Context, s *Session) error
	GetByTokenHash(ctx context.Context, tokenHash string) (*Session, error)
	// ListByUserID returns the user's sessions still valid at now, most
	// recently used first.
	ListByUserID(ctx context.Context, userID uuid.UUID, now time.Time) ([]Session, error)
	// Touch records that the session was used at from ip.
	Touch(ctx context.Context, tokenHash string, at time.Time, ip string) error
	Delete(ctx context.Context, tokenHash string) error
	// DeleteByID deletes one of the user's sessions, or returns ErrNotFound.
	DeleteByID(ctx context.Context, userID, id uuid.UUID) error
	DeleteByUserID(ctx context.Context, userID uuid.UUID) error
	// DeleteOthers deletes every session of the user but the one with keepTokenHash.
	DeleteOthers(ctx context.Context, userID uuid.UUID, keepTokenHash string) error
	DeleteExpired(ctx context.Context, now time.Time) error
}

// Client is who makes a request, recorded on the sessions it starts.
type Client struct {
	UserAgent string
	IP        string
}

type clientKey struct{}

// WithClient attaches the requesting client to ctx.
func WithClient(ctx context.Context, c Client) context.Context {
	return context.WithValue(ctx, clientKey{}, c)
}

// ClientFrom returns the client attached by WithClient, or a zero Client.
func ClientFrom(ctx context.Context) Client {
	c, _ := ctx.Value(clientKey{}).(Client)
	return c
}
