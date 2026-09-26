package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const (
	MinPasswordLength = 8
	// VerificationTTL is how long an email verification link stays valid. No
	// new link is sent while one is still valid.
	VerificationTTL = 24 * time.Hour
	// PasswordResetTTL is how long a password reset link stays valid.
	PasswordResetTTL = time.Hour
	// PasswordResetCooldown is the minimum delay between two reset emails to
	// the same account, so the form cannot be used to flood an inbox.
	PasswordResetCooldown = time.Minute
)

type Service struct {
	users         domain.UserRepository
	sessions      domain.SessionRepository
	verifications domain.EmailVerificationRepository
	resets        domain.PasswordResetRepository
	hasher        domain.PasswordHasher
	mailer        domain.Mailer
	ttl           time.Duration
	appURL        string
	now           func() time.Time
	dummyHash     string
}

// NewService builds the auth service. appURL is the public base URL of the
// app, used in the links it emails.
func NewService(
	users domain.UserRepository,
	sessions domain.SessionRepository,
	verifications domain.EmailVerificationRepository,
	resets domain.PasswordResetRepository,
	hasher domain.PasswordHasher,
	mailer domain.Mailer,
	ttl time.Duration,
	appURL string,
) (*Service, error) {
	// Used to keep login timing constant when the email is unknown.
	dummy, err := hasher.Hash("dummy-password-for-timing")
	if err != nil {
		return nil, err
	}
	return &Service{
		users:         users,
		sessions:      sessions,
		verifications: verifications,
		resets:        resets,
		hasher:        hasher,
		mailer:        mailer,
		ttl:           ttl,
		appURL:        strings.TrimRight(appURL, "/"),
		now:           time.Now,
		dummyHash:     dummy,
	}, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Register creates an unverified account and emails it a verification link.
// The account cannot sign in until the link is followed.
func (s *Service) Register(ctx context.Context, email, password string) (*domain.User, error) {
	email = normalizeEmail(email)
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email {
		return nil, &domain.ValidationError{Field: "email", Message: "invalid email address"}
	}
	if err := validatePassword("password", password); err != nil {
		return nil, err
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
	u := &domain.User{ID: uuid.New(), Email: email, PasswordHash: hash, Visibility: domain.VisibilityPrivate, CreatedAt: s.now()}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	// The account exists either way; the next sign-in attempt retries.
	if err := s.sendVerification(ctx, u); err != nil {
		slog.Error("send verification email", "user", u.ID, "err", err)
	}
	return u, nil
}

func validatePassword(field, password string) error {
	if len(password) < MinPasswordLength {
		return &domain.ValidationError{Field: field, Message: "must be at least 8 characters"}
	}
	// bcrypt ignores anything past 72 bytes.
	if len(password) > 72 {
		return &domain.ValidationError{Field: field, Message: "must be at most 72 characters"}
	}
	return nil
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
	if u.EmailVerifiedAt == nil {
		if err := s.ensureVerificationSent(ctx, u); err != nil {
			slog.Error("send verification email", "user", u.ID, "err", err)
		}
		return "", nil, domain.ErrEmailNotVerified
	}
	return s.startSession(ctx, u.ID)
}

// VerifyEmail consumes a verification token, marks the email verified and
// signs the user in.
func (s *Service) VerifyEmail(ctx context.Context, token string) (string, *domain.Session, error) {
	if token == "" {
		return "", nil, domain.ErrInvalidToken
	}
	v, err := s.verifications.Consume(ctx, hashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return "", nil, domain.ErrInvalidToken
	}
	if err != nil {
		return "", nil, err
	}
	now := s.now()
	if !now.Before(v.ExpiresAt) {
		return "", nil, domain.ErrInvalidToken
	}
	if err := s.users.MarkEmailVerified(ctx, v.UserID, now); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return "", nil, domain.ErrInvalidToken
		}
		return "", nil, err
	}
	return s.startSession(ctx, v.UserID)
}

// ensureVerificationSent emails a verification link unless a valid one was
// already sent, so repeated sign-in attempts cannot spam the inbox.
func (s *Service) ensureVerificationSent(ctx context.Context, u *domain.User) error {
	prev, err := s.verifications.GetByUserID(ctx, u.ID)
	if err == nil && s.now().Before(prev.ExpiresAt) {
		return nil
	}
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return err
	}
	return s.sendVerification(ctx, u)
}

func (s *Service) sendVerification(ctx context.Context, u *domain.User) (err error) {
	token, err := newToken()
	if err != nil {
		return err
	}
	now := s.now()
	v := &domain.EmailVerification{TokenHash: hashToken(token), UserID: u.ID, ExpiresAt: now.Add(VerificationTTL), CreatedAt: now}
	if err := s.verifications.Replace(ctx, v); err != nil {
		return err
	}
	link := s.appURL + "/verify?token=" + url.QueryEscape(token)
	defer func() {
		// An undelivered link must not block the next attempt until it expires.
		if err != nil {
			_ = s.verifications.DeleteByUserID(context.WithoutCancel(ctx), u.ID)
		}
	}()
	body := fmt.Sprintf(`Welcome to GPX Viewer!

Confirm your email address by opening this link:

%s

The link expires in 24 hours. If you did not create an account, ignore this email.
`, link)
	return s.mailer.Send(ctx, u.Email, "Confirm your email address", body)
}

// RequestPasswordReset emails a reset link to the account, if there is one.
// Unknown emails succeed silently so the form does not reveal who signed up.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	u, err := s.users.GetByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	prev, err := s.resets.GetByUserID(ctx, u.ID)
	if err == nil && s.now().Before(prev.CreatedAt.Add(PasswordResetCooldown)) {
		return nil
	}
	if err != nil && !errors.Is(err, domain.ErrNotFound) {
		return err
	}
	return s.sendPasswordReset(ctx, u)
}

func (s *Service) sendPasswordReset(ctx context.Context, u *domain.User) (err error) {
	token, err := newToken()
	if err != nil {
		return err
	}
	now := s.now()
	p := &domain.PasswordReset{TokenHash: hashToken(token), UserID: u.ID, ExpiresAt: now.Add(PasswordResetTTL), CreatedAt: now}
	if err := s.resets.Replace(ctx, p); err != nil {
		return err
	}
	link := s.appURL + "/reset-password?token=" + url.QueryEscape(token)
	defer func() {
		// An undelivered link must not hold the cooldown.
		if err != nil {
			_ = s.resets.DeleteByUserID(context.WithoutCancel(ctx), u.ID)
		}
	}()
	body := fmt.Sprintf(`Someone asked to reset the password of your GPX Viewer account.

Choose a new password by opening this link:

%s

The link expires in 1 hour. If you did not ask for this, ignore this email; your password stays the same.
`, link)
	return s.mailer.Send(ctx, u.Email, "Reset your password", body)
}

// ResetPassword consumes a reset token, sets the new password, signs out
// every session and signs the user in.
func (s *Service) ResetPassword(ctx context.Context, token, password string) (string, *domain.Session, error) {
	if token == "" {
		return "", nil, domain.ErrInvalidToken
	}
	// Checked first so a rejected password does not burn the link.
	if err := validatePassword("password", password); err != nil {
		return "", nil, err
	}
	p, err := s.resets.Consume(ctx, hashToken(token))
	if errors.Is(err, domain.ErrNotFound) {
		return "", nil, domain.ErrInvalidToken
	}
	if err != nil {
		return "", nil, err
	}
	now := s.now()
	if !now.Before(p.ExpiresAt) {
		return "", nil, domain.ErrInvalidToken
	}
	u, err := s.users.GetByID(ctx, p.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return "", nil, domain.ErrInvalidToken
	}
	if err != nil {
		return "", nil, err
	}
	if err := s.setPassword(ctx, u.ID, password); err != nil {
		return "", nil, err
	}
	// Following the emailed link proves the address is theirs.
	if u.EmailVerifiedAt == nil {
		if err := s.users.MarkEmailVerified(ctx, u.ID, now); err != nil {
			return "", nil, err
		}
	}
	return s.startSession(ctx, u.ID)
}

// ChangePassword replaces the password of a signed-in user after checking the
// current one. Every session is signed out and a new one is returned.
func (s *Service) ChangePassword(ctx context.Context, userID uuid.UUID, current, password string) (string, *domain.Session, error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", nil, err
	}
	if err := s.hasher.Compare(u.PasswordHash, current); err != nil {
		return "", nil, &domain.ValidationError{Field: "currentPassword", Message: "current password is incorrect"}
	}
	if err := validatePassword("password", password); err != nil {
		return "", nil, err
	}
	if err := s.setPassword(ctx, u.ID, password); err != nil {
		return "", nil, err
	}
	return s.startSession(ctx, u.ID)
}

// setPassword stores a new password and revokes every session, so whoever
// knew the old one is signed out.
func (s *Service) setPassword(ctx context.Context, userID uuid.UUID, password string) error {
	hash, err := s.hasher.Hash(password)
	if err != nil {
		return err
	}
	if err := s.users.UpdatePassword(ctx, userID, hash); err != nil {
		return err
	}
	if err := s.sessions.DeleteByUserID(ctx, userID); err != nil {
		return err
	}
	return s.resets.DeleteByUserID(ctx, userID)
}

func (s *Service) startSession(ctx context.Context, userID uuid.UUID) (string, *domain.Session, error) {
	token, err := newToken()
	if err != nil {
		return "", nil, err
	}
	now := s.now()
	sess := &domain.Session{TokenHash: hashToken(token), UserID: userID, ExpiresAt: now.Add(s.ttl), CreatedAt: now}
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

// PurgeExpired deletes expired sessions, verification and reset links.
func (s *Service) PurgeExpired(ctx context.Context) error {
	now := s.now()
	return errors.Join(
		s.sessions.DeleteExpired(ctx, now),
		s.verifications.DeleteExpired(ctx, now),
		s.resets.DeleteExpired(ctx, now),
	)
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
