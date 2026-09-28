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
	"unicode/utf8"

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
	// InviteTTL is how long the link of an account created by an admin stays
	// valid.
	InviteTTL = 7 * 24 * time.Hour
	// AdminResetTTL is how long a password link an admin hands out stays valid.
	AdminResetTTL = 24 * time.Hour
	// sessionTouchInterval is how stale a session's last use may get before
	// a request records it again, so browsing does not write on every call.
	sessionTouchInterval = 5 * time.Minute
	maxUserAgentLength   = 512
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
	registration  bool
	now           func() time.Time
	dummyHash     string
}

// NewService builds the auth service. appURL is the public base URL of the
// app, used in the links it emails. Unless registration is enabled, only the
// first account can sign up; admins invite the others. mailer is nil when no
// mail server is configured: emails are then never required to be verified,
// and links are only handed out by admins.
func NewService(
	users domain.UserRepository,
	sessions domain.SessionRepository,
	verifications domain.EmailVerificationRepository,
	resets domain.PasswordResetRepository,
	hasher domain.PasswordHasher,
	mailer domain.Mailer,
	ttl time.Duration,
	appURL string,
	registration bool,
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
		registration:  registration,
		now:           time.Now,
		dummyHash:     dummy,
	}, nil
}

// EmailEnabled reports whether a mail server is configured.
func (s *Service) EmailEnabled() bool {
	return s.mailer != nil
}

// RequiresVerifiedEmail reports whether accounts must verify their email
// before signing in, which needs a mail server to send the link.
func (s *Service) RequiresVerifiedEmail() bool {
	return s.EmailEnabled()
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// RegistrationEnabled reports whether REGISTRATION_ENABLED lets anyone sign up.
func (s *Service) RegistrationEnabled() bool {
	return s.registration
}

// RegistrationOpen reports whether the sign-up form accepts new accounts:
// when registration is enabled, or to create the first account.
func (s *Service) RegistrationOpen(ctx context.Context) (bool, error) {
	if s.registration {
		return true, nil
	}
	n, err := s.users.Count(ctx)
	return n == 0, err
}

// Register creates an unverified account. With a mail server, it emails a
// verification link and the account cannot sign in until the link is
// followed; without one, it can sign in right away. The first account becomes
// the admin.
func (s *Service) Register(ctx context.Context, email, password string) (*domain.User, error) {
	email = normalizeEmail(email)
	if err := validateEmail(email); err != nil {
		return nil, err
	}
	if err := validatePassword("password", password); err != nil {
		return nil, err
	}
	n, err := s.users.Count(ctx)
	if err != nil {
		return nil, err
	}
	if n > 0 && !s.registration {
		return nil, domain.ErrRegistrationClosed
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
	u := &domain.User{ID: uuid.New(), Email: email, PasswordHash: hash, Visibility: domain.VisibilityPrivate, IsAdmin: n == 0, CreatedAt: s.now()}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, err
	}
	if !s.EmailEnabled() {
		return u, nil
	}
	// The account exists either way; the next sign-in attempt retries.
	if err := s.sendVerification(ctx, u); err != nil {
		slog.Error("send verification email", "user", u.ID, "err", err)
	}
	return u, nil
}

// Invite creates an account for email on behalf of an admin, whatever the
// registration setting, and returns a link where its owner chooses a
// password. Following the link also verifies the email. The link is emailed
// when send is set and a mail server is configured; a failed delivery is
// logged and reported by emailed, and the link still works.
func (s *Service) Invite(ctx context.Context, email, name string, send bool) (u *domain.User, link string, emailed bool, err error) {
	email = normalizeEmail(email)
	if err := validateEmail(email); err != nil {
		return nil, "", false, err
	}
	if _, err := s.users.GetByEmail(ctx, email); err == nil {
		return nil, "", false, domain.ErrEmailTaken
	} else if !errors.Is(err, domain.ErrNotFound) {
		return nil, "", false, err
	}
	// Nobody knows this password, so the account is unusable until the link
	// is followed.
	secret, err := newToken()
	if err != nil {
		return nil, "", false, err
	}
	hash, err := s.hasher.Hash(secret)
	if err != nil {
		return nil, "", false, err
	}
	now := s.now()
	u = &domain.User{ID: uuid.New(), Email: email, Name: name, PasswordHash: hash, Visibility: domain.VisibilityPrivate, InvitedAt: &now, CreatedAt: now}
	if err := s.users.Create(ctx, u); err != nil {
		return nil, "", false, err
	}
	link, emailed, err = s.sendPasswordLink(ctx, u, send)
	return u, link, emailed, err
}

// PasswordLink issues a new link where a user chooses a password, for an
// admin to hand over: the invite link again while an invite is pending,
// otherwise a password reset link, which is how people who forgot their
// password get back in without email. It is emailed when send is set and a
// mail server is configured.
func (s *Service) PasswordLink(ctx context.Context, userID uuid.UUID, send bool) (link string, emailed bool, err error) {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return "", false, err
	}
	if u.BannedAt != nil {
		return "", false, &domain.ValidationError{Field: "user", Message: "lift their ban first"}
	}
	return s.sendPasswordLink(ctx, u, send)
}

func (s *Service) sendPasswordLink(ctx context.Context, u *domain.User, send bool) (link string, emailed bool, err error) {
	invite := u.InvitedAt != nil
	ttl := AdminResetTTL
	if invite {
		ttl = InviteTTL
	}
	token, err := s.issueReset(ctx, u.ID, ttl)
	if err != nil {
		return "", false, err
	}
	link = s.appURL + "/reset-password?token=" + url.QueryEscape(token)
	if invite {
		link = s.appURL + "/reset-password?invite=1&token=" + url.QueryEscape(token)
	}
	if !send || !s.EmailEnabled() {
		return link, false, nil
	}
	subject, body := "Choose a new password", fmt.Sprintf(`An admin of GPX Viewer sent you a link to choose a new password:

%s

The link expires in 24 hours. Your current password works until you use it.
`, link)
	if invite {
		subject, body = "You're invited to GPX Viewer", fmt.Sprintf(`You have been invited to GPX Viewer!

Choose a password to finish creating your account:

%s

The link expires in 7 days.
`, link)
	}
	if err := s.mailer.Send(ctx, u.Email, subject, body); err != nil {
		slog.Error("send password link", "user", u.ID, "err", err)
		return link, false, nil
	}
	return link, true, nil
}

func validateEmail(email string) error {
	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email {
		return &domain.ValidationError{Field: "email", Message: "invalid email address"}
	}
	return nil
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
	if u.BannedAt != nil {
		return "", nil, &domain.BannedError{Reason: u.BanReason}
	}
	if u.EmailVerifiedAt == nil && s.RequiresVerifiedEmail() {
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
	u, err := s.users.GetByID(ctx, v.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return "", nil, domain.ErrInvalidToken
	}
	if err != nil {
		return "", nil, err
	}
	if err := s.users.MarkEmailVerified(ctx, u.ID, now); err != nil {
		return "", nil, err
	}
	if u.BannedAt != nil {
		return "", nil, &domain.BannedError{Reason: u.BanReason}
	}
	return s.startSession(ctx, u.ID)
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
// Without a mail server it fails with ErrEmailDisabled: an admin hands out
// the link instead.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	if !s.EmailEnabled() {
		return domain.ErrEmailDisabled
	}
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

// issueReset stores a new password reset token for the user, replacing any
// previous one, and returns it.
func (s *Service) issueReset(ctx context.Context, userID uuid.UUID, ttl time.Duration) (string, error) {
	token, err := newToken()
	if err != nil {
		return "", err
	}
	now := s.now()
	p := &domain.PasswordReset{TokenHash: hashToken(token), UserID: userID, ExpiresAt: now.Add(ttl), CreatedAt: now}
	if err := s.resets.Replace(ctx, p); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) sendPasswordReset(ctx context.Context, u *domain.User) (err error) {
	token, err := s.issueReset(ctx, u.ID, PasswordResetTTL)
	if err != nil {
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
	if u.BannedAt != nil {
		return "", nil, &domain.BannedError{Reason: u.BanReason}
	}
	if err := s.setPassword(ctx, u.ID, password); err != nil {
		return "", nil, err
	}
	// Following the link, emailed or handed over by an admin, vouches for the
	// address, and accepts a pending invite.
	if u.EmailVerifiedAt == nil {
		if err := s.users.MarkEmailVerified(ctx, u.ID, now); err != nil {
			return "", nil, err
		}
	}
	if u.InvitedAt != nil {
		if err := s.users.AcceptInvite(ctx, u.ID); err != nil {
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

// DeleteAccount permanently removes a signed-in user and everything tied to
// them, after checking their password.
func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID, password string) error {
	u, err := s.users.GetByID(ctx, userID)
	if err != nil {
		return err
	}
	if err := s.hasher.Compare(u.PasswordHash, password); err != nil {
		return &domain.ValidationError{Field: "password", Message: "password is incorrect"}
	}
	if u.IsAdmin {
		if err := s.ensureOtherAdmin(ctx); err != nil {
			return err
		}
	}
	return s.users.Delete(ctx, u.ID)
}

// ensureOtherAdmin refuses to remove the last admin while other accounts
// remain, so the instance always has someone to manage it.
func (s *Service) ensureOtherAdmin(ctx context.Context) error {
	admins, err := s.users.CountAdmins(ctx)
	if err != nil {
		return err
	}
	users, err := s.users.Count(ctx)
	if err != nil {
		return err
	}
	if admins <= 1 && users > 1 {
		return &domain.ValidationError{Field: "account", Message: "you are the only admin; make someone else an admin first"}
	}
	return nil
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
	client := domain.ClientFrom(ctx)
	sess := &domain.Session{
		ID:         uuid.New(),
		TokenHash:  hashToken(token),
		UserID:     userID,
		UserAgent:  truncate(client.UserAgent, maxUserAgentLength),
		IP:         client.IP,
		ExpiresAt:  now.Add(s.ttl),
		LastUsedAt: now,
		CreatedAt:  now,
	}
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
	now := s.now()
	if !now.Before(sess.ExpiresAt) {
		_ = s.sessions.Delete(ctx, sess.TokenHash)
		return nil, domain.ErrUnauthorized
	}
	if now.Sub(sess.LastUsedAt) >= sessionTouchInterval {
		// Only informs the sessions list; not worth failing the request.
		if err := s.sessions.Touch(ctx, sess.TokenHash, now, domain.ClientFrom(ctx).IP); err != nil {
			slog.Warn("touch session", "err", err)
		}
	}
	u, err := s.users.GetByID(ctx, sess.UserID)
	if errors.Is(err, domain.ErrNotFound) {
		return nil, domain.ErrUnauthorized
	}
	if err != nil {
		return nil, err
	}
	// Banning revokes sessions; this covers a ban racing a sign-in.
	if u.BannedAt != nil {
		return nil, domain.ErrUnauthorized
	}
	return u, nil
}

// Sessions lists the user's live sessions, most recently used first, with
// the ID of the one token belongs to (uuid.Nil if none).
func (s *Service) Sessions(ctx context.Context, userID uuid.UUID, token string) ([]domain.Session, uuid.UUID, error) {
	list, err := s.sessions.ListByUserID(ctx, userID, s.now())
	if err != nil {
		return nil, uuid.Nil, err
	}
	current := uuid.Nil
	hash := hashToken(token)
	for _, sess := range list {
		if sess.TokenHash == hash {
			current = sess.ID
		}
	}
	return list, current, nil
}

// RevokeSession signs one of the user's other devices out. The session token
// belongs to is refused: signing out does that.
func (s *Service) RevokeSession(ctx context.Context, userID, id uuid.UUID, token string) error {
	if sess, err := s.sessions.GetByTokenHash(ctx, hashToken(token)); err == nil && sess.ID == id {
		return &domain.ValidationError{Field: "session", Message: "this is your current session; sign out instead"}
	}
	return s.sessions.DeleteByID(ctx, userID, id)
}

// RevokeOtherSessions signs the user out everywhere but the session of token.
func (s *Service) RevokeOtherSessions(ctx context.Context, userID uuid.UUID, token string) error {
	return s.sessions.DeleteOthers(ctx, userID, hashToken(token))
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

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	s = s[:n]
	// Drop a rune cut in half.
	for len(s) > 0 && !utf8.ValidString(s) {
		s = s[:len(s)-1]
	}
	return s
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
