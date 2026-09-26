package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const MinPasswordLength = 8

type Service struct {
	users     domain.UserRepository
	sessions  domain.SessionRepository
	hasher    domain.PasswordHasher
	ttl       time.Duration
	now       func() time.Time
	dummyHash string
}

func NewService(users domain.UserRepository, sessions domain.SessionRepository, hasher domain.PasswordHasher, ttl time.Duration) (*Service, error) {
	// Used to keep login timing constant when the email is unknown.
	dummy, err := hasher.Hash("dummy-password-for-timing")
	if err != nil {
		return nil, err
	}
	return &Service{users: users, sessions: sessions, hasher: hasher, ttl: ttl, now: time.Now, dummyHash: dummy}, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func (s *Service) Register(ctx context.Context, email, password string) (*domain.User, error) {
	email = normalizeEmail(email)
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email {
		return nil, &domain.ValidationError{Field: "email", Message: "invalid email address"}
	}
	if len(password) < MinPasswordLength {
		return nil, &domain.ValidationError{Field: "password", Message: "must be at least 8 characters"}
	}
	if len(password) > 72 {
		return nil, &domain.ValidationError{Field: "password", Message: "must be at most 72 characters"}
	}
	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, domain.ErrEmailTaken
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, err
	}

	hash, err := s.hasher.Hash(password)
	if err != nil {
		return nil, err
	}
	u := &domain.User{ID: uuid.New(), Email: email, PasswordHash: hash, CreatedAt: s.now()}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// Login verifies credentials and returns a new opaque session token.
func (s *Service) Login(ctx context.Context, email, password string) (string, *domain.Session, error) {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrNotFound) {
		_ = s.hasher.Compare(s.dummyHash, password)
		return "", nil, domain.ErrInvalidCredentials
	}
	if err != nil {
		return "", nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, password); err != nil {
		return "", nil, domain.ErrInvalidCredentials
	}

	token, err := newToken()
	if err != nil {
		return "", nil, err
	}
	now := s.now()
	sess := &domain.Session{TokenHash: hashToken(token), UserID: u.ID, ExpiresAt: now.Add(s.ttl), CreatedAt: now}
	if err := s.sessions.Create(ctx, sess); err != nil {
		return "", nil, err
	}
	return token, sess, nil
}

func (s *Service) Logout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.sessions.Delete(ctx, hashToken(token))
}

// Authenticate resolves a session token to its user.
func (s *Service) Authenticate(ctx context.Context, token string) (*domain.User, error) {
	if token == "" {
		return nil, domain.ErrUnauthorized
	}
	sess, err := s.sessions.GetByTokenHash(ctx, hashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return nil, domain.ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	if !s.now().Before(sess.ExpiresAt) {
		_ = s.sessions.Delete(ctx, sess.TokenHash)
		return nil, domain.ErrUnauthorized
	}
	u, err := s.users.GetByID(ctx, sess.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, domain.ErrUnauthorized
	}
	return u, err
}

func (s *Service) PurgeExpiredSessions(ctx context.Context) error {
	return s.sessions.DeleteExpired(ctx, s.now())
}

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
