package auth

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers struct{ byID map[uuid.UUID]*domain.User }

func (f *fakeUsers) Create(_ context.Context, u *domain.User) error {
	for _, e := range f.byID {
		if e.Email == u.Email {
			return domain.ErrEmailTaken
		}
	}
	f.byID[u.ID] = u
	return nil
}

func (f *fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := f.byID[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) GetByEmail(_ context.Context, email string) (*domain.User, error) {
	for _, u := range f.byID {
		if u.Email == email {
			return u, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeUsers) UpdatePassword(_ context.Context, id uuid.UUID, hash string) error {
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.PasswordHash = hash
	return nil
}

func (f *fakeUsers) Delete(_ context.Context, id uuid.UUID) error {
	if _, ok := f.byID[id]; !ok {
		return domain.ErrNotFound
	}
	delete(f.byID, id)
	return nil
}

func (f *fakeUsers) Count(context.Context) (int64, error) {
	return int64(len(f.byID)), nil
}

func (f *fakeUsers) CountAdmins(context.Context) (int64, error) {
	var n int64
	for _, u := range f.byID {
		if u.IsAdmin {
			n++
		}
	}
	return n, nil
}

func (f *fakeUsers) MarkEmailVerified(_ context.Context, id uuid.UUID, at time.Time) error {
	u, ok := f.byID[id]
	if !ok {
		return domain.ErrNotFound
	}
	u.EmailVerifiedAt = &at
	return nil
}

type fakeSessions struct{ byHash map[string]*domain.Session }

func (f *fakeSessions) Create(_ context.Context, s *domain.Session) error {
	f.byHash[s.TokenHash] = s
	return nil
}

func (f *fakeSessions) GetByTokenHash(_ context.Context, h string) (*domain.Session, error) {
	if s, ok := f.byHash[h]; ok {
		return s, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeSessions) Delete(_ context.Context, h string) error {
	delete(f.byHash, h)
	return nil
}

func (f *fakeSessions) DeleteByUserID(_ context.Context, id uuid.UUID) error {
	for h, s := range f.byHash {
		if s.UserID == id {
			delete(f.byHash, h)
		}
	}
	return nil
}

func (f *fakeSessions) ListByUserID(_ context.Context, id uuid.UUID, now time.Time) ([]domain.Session, error) {
	var out []domain.Session
	for _, s := range f.byHash {
		if s.UserID == id && now.Before(s.ExpiresAt) {
			out = append(out, *s)
		}
	}
	return out, nil
}

func (f *fakeSessions) Touch(_ context.Context, h string, at time.Time, ip string) error {
	if s, ok := f.byHash[h]; ok {
		s.LastUsedAt, s.IP = at, ip
	}
	return nil
}

func (f *fakeSessions) DeleteByID(_ context.Context, userID, id uuid.UUID) error {
	for h, s := range f.byHash {
		if s.UserID == userID && s.ID == id {
			delete(f.byHash, h)
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeSessions) DeleteOthers(_ context.Context, userID uuid.UUID, keep string) error {
	for h, s := range f.byHash {
		if s.UserID == userID && h != keep {
			delete(f.byHash, h)
		}
	}
	return nil
}

func (f *fakeSessions) DeleteExpired(_ context.Context, now time.Time) error {
	for h, s := range f.byHash {
		if !now.Before(s.ExpiresAt) {
			delete(f.byHash, h)
		}
	}
	return nil
}

type fakeVerifications struct {
	byUser map[uuid.UUID]*domain.EmailVerification
}

func (f *fakeVerifications) Replace(_ context.Context, v *domain.EmailVerification) error {
	f.byUser[v.UserID] = v
	return nil
}

func (f *fakeVerifications) GetByUserID(_ context.Context, id uuid.UUID) (*domain.EmailVerification, error) {
	if v, ok := f.byUser[id]; ok {
		return v, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeVerifications) DeleteByUserID(_ context.Context, id uuid.UUID) error {
	delete(f.byUser, id)
	return nil
}

func (f *fakeVerifications) Consume(_ context.Context, h string) (*domain.EmailVerification, error) {
	for id, v := range f.byUser {
		if v.TokenHash == h {
			delete(f.byUser, id)
			return v, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeVerifications) DeleteExpired(_ context.Context, now time.Time) error {
	for id, v := range f.byUser {
		if !now.Before(v.ExpiresAt) {
			delete(f.byUser, id)
		}
	}
	return nil
}

type fakeResets struct {
	byUser map[uuid.UUID]*domain.PasswordReset
}

func (f *fakeResets) Replace(_ context.Context, p *domain.PasswordReset) error {
	f.byUser[p.UserID] = p
	return nil
}

func (f *fakeResets) GetByUserID(_ context.Context, id uuid.UUID) (*domain.PasswordReset, error) {
	if p, ok := f.byUser[id]; ok {
		return p, nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeResets) DeleteByUserID(_ context.Context, id uuid.UUID) error {
	delete(f.byUser, id)
	return nil
}

func (f *fakeResets) Consume(_ context.Context, h string) (*domain.PasswordReset, error) {
	for id, p := range f.byUser {
		if p.TokenHash == h {
			delete(f.byUser, id)
			return p, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeResets) DeleteExpired(_ context.Context, now time.Time) error {
	for id, p := range f.byUser {
		if !now.Before(p.ExpiresAt) {
			delete(f.byUser, id)
		}
	}
	return nil
}

type sentMail struct{ to, subject, body string }

type fakeMailer struct {
	sent []sentMail
	err  error
}

func (f *fakeMailer) Send(_ context.Context, to, subject, body string) error {
	if f.err != nil {
		return f.err
	}
	f.sent = append(f.sent, sentMail{to, subject, body})
	return nil
}

var linkRe = regexp.MustCompile(`https://app\.test/(?:verify|reset-password)\?token=(\S+)`)

// lastToken extracts the token from the link in the last email sent.
func (f *fakeMailer) lastToken(t *testing.T) string {
	t.Helper()
	if len(f.sent) == 0 {
		t.Fatal("no email sent")
	}
	m := linkRe.FindStringSubmatch(f.sent[len(f.sent)-1].body)
	if m == nil {
		t.Fatalf("no link in %q", f.sent[len(f.sent)-1].body)
	}
	token, err := url.QueryUnescape(m[1])
	if err != nil {
		t.Fatal(err)
	}
	return token
}

// plainHasher avoids bcrypt cost in tests.
type plainHasher struct{}

func (plainHasher) Hash(p string) (string, error) { return "h:" + p, nil }
func (plainHasher) Compare(h, p string) error {
	if h != "h:"+p {
		return errors.New("mismatch")
	}
	return nil
}

type testEnv struct {
	svc           *Service
	users         *fakeUsers
	sessions      *fakeSessions
	verifications *fakeVerifications
	resets        *fakeResets
	mailer        *fakeMailer
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	e := &testEnv{
		users:         &fakeUsers{byID: map[uuid.UUID]*domain.User{}},
		sessions:      &fakeSessions{byHash: map[string]*domain.Session{}},
		verifications: &fakeVerifications{byUser: map[uuid.UUID]*domain.EmailVerification{}},
		resets:        &fakeResets{byUser: map[uuid.UUID]*domain.PasswordReset{}},
		mailer:        &fakeMailer{},
	}
	svc, err := NewService(e.users, e.sessions, e.verifications, e.resets, plainHasher{}, e.mailer, time.Hour, "https://app.test/", true)
	if err != nil {
		t.Fatal(err)
	}
	e.svc = svc
	return e
}

func newTestService(t *testing.T) (*Service, *fakeSessions) {
	t.Helper()
	e := newTestEnv(t)
	return e.svc, e.sessions
}

// registerVerified registers a user and follows their verification link.
func (e *testEnv) registerVerified(t *testing.T, email, password string) *domain.User {
	t.Helper()
	u, err := e.svc.Register(context.Background(), email, password)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.VerifyEmail(context.Background(), e.mailer.lastToken(t)); err != nil {
		t.Fatal(err)
	}
	return u
}

func TestRegisterLoginAuthenticateLogout(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	svc, sessions := e.svc, e.sessions

	u := e.registerVerified(t, "  Alice@Example.com ", "password123")
	if u.Email != "alice@example.com" {
		t.Errorf("email not normalized: %q", u.Email)
	}

	token, _, err := svc.Login(ctx, "ALICE@example.com", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := sessions.byHash[token]; ok {
		t.Error("raw token must not be stored")
	}

	got, err := svc.Authenticate(ctx, token)
	if err != nil || got.ID != u.ID {
		t.Fatalf("authenticate: %v, %v", got, err)
	}

	if err := svc.Logout(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("after logout err = %v", err)
	}
}

func TestRegisterValidation(t *testing.T) {
	ctx := context.Background()
	svc, _ := newTestService(t)

	var ve *domain.ValidationError
	if _, err := svc.Register(ctx, "not-an-email", "password123"); !errors.As(err, &ve) || ve.Field != "email" {
		t.Errorf("bad email err = %v", err)
	}
	if _, err := svc.Register(ctx, "a@b.co", "short"); !errors.As(err, &ve) || ve.Field != "password" {
		t.Errorf("short password err = %v", err)
	}
	if _, err := svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Register(ctx, "A@b.co", "password123"); !errors.Is(err, domain.ErrEmailTaken) {
		t.Errorf("duplicate err = %v", err)
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	svc := e.svc
	e.registerVerified(t, "a@b.co", "password123")
	if _, _, err := svc.Login(ctx, "a@b.co", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("wrong password err = %v", err)
	}
	if _, _, err := svc.Login(ctx, "nobody@b.co", "password123"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("unknown user err = %v", err)
	}
}

func TestAuthenticateExpired(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	svc, sessions := e.svc, e.sessions
	e.registerVerified(t, "a@b.co", "password123")
	for h := range sessions.byHash {
		delete(sessions.byHash, h)
	}
	token, _, err := svc.Login(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	svc.now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	if _, err := svc.Authenticate(ctx, token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expired err = %v", err)
	}
	if len(sessions.byHash) != 0 {
		t.Error("expired session should be deleted")
	}
}

func TestEmailVerification(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)

	u, err := e.svc.Register(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if len(e.mailer.sent) != 1 || e.mailer.sent[0].to != "a@b.co" {
		t.Fatalf("sent = %+v", e.mailer.sent)
	}
	if len(e.sessions.byHash) != 0 {
		t.Error("register must not start a session")
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrEmailNotVerified) {
		t.Errorf("unverified login err = %v", err)
	}
	// A wrong password must not reveal that the account is unverified.
	if _, _, err := e.svc.Login(ctx, "a@b.co", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("unverified wrong password err = %v", err)
	}

	token := e.mailer.lastToken(t)
	if _, ok := e.verifications.byUser[u.ID]; !ok || e.verifications.byUser[u.ID].TokenHash == token {
		t.Error("only the token hash must be stored")
	}
	sessToken, _, err := e.svc.VerifyEmail(ctx, token)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := e.svc.Authenticate(ctx, sessToken); err != nil || got.ID != u.ID {
		t.Fatalf("authenticate after verify: %v, %v", got, err)
	}
	if _, _, err := e.svc.VerifyEmail(ctx, token); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("reused token err = %v", err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); err != nil {
		t.Errorf("verified login err = %v", err)
	}
	if len(e.mailer.sent) != 1 {
		t.Errorf("sent %d emails, want 1", len(e.mailer.sent))
	}
}

func TestVerifyEmailInvalidToken(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	if _, err := e.svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{"", "nope"} {
		if _, _, err := e.svc.VerifyEmail(ctx, token); !errors.Is(err, domain.ErrInvalidToken) {
			t.Errorf("token %q err = %v", token, err)
		}
	}

	token := e.mailer.lastToken(t)
	e.svc.now = func() time.Time { return time.Now().Add(VerificationTTL + time.Minute) }
	if _, _, err := e.svc.VerifyEmail(ctx, token); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("expired token err = %v", err)
	}
}

func TestUnverifiedLoginSendsLinkOncePerTTL(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u, err := e.svc.Register(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	first := e.mailer.lastToken(t)

	login := func() {
		t.Helper()
		if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrEmailNotVerified) {
			t.Fatalf("unverified login err = %v", err)
		}
	}

	// The link from sign-up is still valid: no new email.
	login()
	login()
	if _, _, err := e.svc.Login(ctx, "a@b.co", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Fatalf("wrong password err = %v", err)
	}
	if len(e.mailer.sent) != 1 {
		t.Fatalf("sent %d emails while the link is valid, want 1", len(e.mailer.sent))
	}

	// Once it expires, the next attempt sends a new link, which replaces it.
	e.svc.now = func() time.Time { return time.Now().Add(VerificationTTL + time.Minute) }
	login()
	login()
	if len(e.mailer.sent) != 2 {
		t.Fatalf("sent %d emails after expiry, want 2", len(e.mailer.sent))
	}
	if _, _, err := e.svc.VerifyEmail(ctx, first); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("superseded token err = %v", err)
	}
	if _, _, err := e.svc.VerifyEmail(ctx, e.mailer.lastToken(t)); err != nil {
		t.Errorf("new token err = %v", err)
	}
	if got, _ := e.svc.users.GetByID(ctx, u.ID); got.EmailVerifiedAt == nil {
		t.Error("user not verified")
	}
}

// Accounts without any link (e.g. created before verification existed) get
// one on their first sign-in attempt.
func TestUnverifiedLoginWithoutLinkSendsOne(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	if _, err := e.svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	e.verifications.byUser = map[uuid.UUID]*domain.EmailVerification{}
	e.mailer.sent = nil

	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrEmailNotVerified) {
		t.Fatalf("err = %v", err)
	}
	if len(e.mailer.sent) != 1 || e.mailer.sent[0].to != "a@b.co" {
		t.Fatalf("sent = %+v", e.mailer.sent)
	}
}

func TestDeleteAccount(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u := e.registerVerified(t, "a@b.co", "password123")

	var ve *domain.ValidationError
	if err := e.svc.DeleteAccount(ctx, u.ID, "wrong-password"); !errors.As(err, &ve) || ve.Field != "password" {
		t.Fatalf("wrong password err = %v", err)
	}
	if _, err := e.svc.users.GetByID(ctx, u.ID); err != nil {
		t.Fatalf("user deleted despite wrong password: %v", err)
	}

	if err := e.svc.DeleteAccount(ctx, u.ID, "password123"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.users.GetByID(ctx, u.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("after delete err = %v", err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("login after delete err = %v", err)
	}
}

func TestFailedSendIsRetriedOnNextLogin(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.mailer.err = errors.New("smtp down")
	if _, err := e.svc.Register(ctx, "a@b.co", "password123"); err != nil {
		t.Fatal(err)
	}
	if len(e.verifications.byUser) != 0 {
		t.Fatal("undelivered link must not be kept")
	}

	e.mailer.err = nil
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrEmailNotVerified) {
		t.Fatalf("err = %v", err)
	}
	if len(e.mailer.sent) != 1 {
		t.Fatalf("sent %d emails, want 1", len(e.mailer.sent))
	}
}

func TestFirstAccountIsAdmin(t *testing.T) {
	e := newTestEnv(t)
	first := e.registerVerified(t, "a@b.co", "password123")
	second := e.registerVerified(t, "c@d.co", "password123")
	if !first.IsAdmin || second.IsAdmin {
		t.Errorf("admins: first %v, second %v", first.IsAdmin, second.IsAdmin)
	}
}

func TestRegistrationClosed(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.svc.registration = false

	if open, err := e.svc.RegistrationOpen(ctx); err != nil || !open {
		t.Fatalf("open before first account = %v, %v", open, err)
	}
	// The first account can always sign up, so the instance gets an admin.
	u, err := e.svc.Register(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if !u.IsAdmin {
		t.Error("first account should be admin")
	}
	if open, err := e.svc.RegistrationOpen(ctx); err != nil || open {
		t.Fatalf("open after first account = %v, %v", open, err)
	}
	if _, err := e.svc.Register(ctx, "c@d.co", "password123"); !errors.Is(err, domain.ErrRegistrationClosed) {
		t.Errorf("second register err = %v", err)
	}
}

func TestBannedCannotSignIn(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u := e.registerVerified(t, "a@b.co", "password123")
	token, _, err := e.svc.Login(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	u.BannedAt, u.BanReason = &now, "spam"

	var be *domain.BannedError
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.As(err, &be) || be.Reason != "spam" {
		t.Errorf("login err = %v", err)
	}
	// The reason is only shown to whoever knows the password.
	if _, _, err := e.svc.Login(ctx, "a@b.co", "wrong-password"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("wrong password err = %v", err)
	}
	if _, err := e.svc.Authenticate(ctx, token); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("authenticate err = %v", err)
	}

	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.ResetPassword(ctx, e.mailer.lastToken(t), "password456"); !errors.As(err, &be) {
		t.Errorf("reset err = %v", err)
	}
	if u.PasswordHash != "h:password123" {
		t.Error("banned user changed their password")
	}
}

func TestBannedCannotVerify(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u, err := e.svc.Register(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	u.BannedAt, u.BanReason = &now, "spam"
	var be *domain.BannedError
	if _, _, err := e.svc.VerifyEmail(ctx, e.mailer.lastToken(t)); !errors.As(err, &be) {
		t.Errorf("verify err = %v", err)
	}
	if len(e.sessions.byHash) != 0 {
		t.Error("banned user got a session")
	}
}

func TestInvite(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.registerVerified(t, "admin@b.co", "password123")
	e.svc.registration = false
	sent := len(e.mailer.sent)

	u, link, emailed, err := e.svc.Invite(ctx, " Friend@B.co ", "Friend", false)
	if err != nil {
		t.Fatal(err)
	}
	if emailed || len(e.mailer.sent) != sent {
		t.Error("invite emailed without being asked")
	}
	if u.Email != "friend@b.co" || u.Name != "Friend" || u.IsAdmin || u.EmailVerifiedAt != nil {
		t.Errorf("invited user = %+v", u)
	}
	if _, _, _, err := e.svc.Invite(ctx, "friend@b.co", "", false); !errors.Is(err, domain.ErrEmailTaken) {
		t.Errorf("duplicate invite err = %v", err)
	}

	// A new link replaces the first one.
	link2, emailed, err := e.svc.ReissueInvite(ctx, u.ID, true)
	if err != nil || !emailed {
		t.Fatalf("reissue = %v, %v", emailed, err)
	}
	if !strings.Contains(e.mailer.sent[len(e.mailer.sent)-1].body, link2) {
		t.Error("emailed invite lacks the link")
	}
	if _, _, err := e.svc.ResetPassword(ctx, inviteToken(t, link), "password456"); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("replaced link err = %v", err)
	}
	if _, _, err := e.svc.ResetPassword(ctx, inviteToken(t, link2), "password456"); err != nil {
		t.Fatal(err)
	}
	if u.EmailVerifiedAt == nil {
		t.Error("following the invite should verify the email")
	}
	if _, _, err := e.svc.Login(ctx, "friend@b.co", "password456"); err != nil {
		t.Errorf("login after invite: %v", err)
	}
	var ve *domain.ValidationError
	if _, _, err := e.svc.ReissueInvite(ctx, u.ID, false); !errors.As(err, &ve) {
		t.Errorf("reissue to verified user err = %v", err)
	}
}

func inviteToken(t *testing.T, link string) string {
	t.Helper()
	u, err := url.Parse(link)
	if err != nil || u.Query().Get("invite") != "1" {
		t.Fatalf("bad invite link %q", link)
	}
	return u.Query().Get("token")
}

func TestLastAdminCannotDeleteAccount(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	admin := e.registerVerified(t, "a@b.co", "password123")
	other := e.registerVerified(t, "c@d.co", "password123")

	var ve *domain.ValidationError
	if err := e.svc.DeleteAccount(ctx, admin.ID, "password123"); !errors.As(err, &ve) || ve.Field != "account" {
		t.Fatalf("err = %v", err)
	}
	other.IsAdmin = true
	if err := e.svc.DeleteAccount(ctx, admin.ID, "password123"); err != nil {
		t.Fatal(err)
	}
}

func TestSessions(t *testing.T) {
	e := newTestEnv(t)
	e.registerVerified(t, "a@b.co", "password123")
	laptop := domain.WithClient(context.Background(), domain.Client{UserAgent: "Firefox", IP: "10.0.0.1"})
	phone := domain.WithClient(context.Background(), domain.Client{UserAgent: "Safari", IP: "10.0.0.2"})
	lt, _, err := e.svc.Login(laptop, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	pt, _, err := e.svc.Login(phone, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	u, err := e.svc.Authenticate(laptop, lt)
	if err != nil {
		t.Fatal(err)
	}

	list, current, err := e.svc.Sessions(laptop, u.ID, lt)
	if err != nil {
		t.Fatal(err)
	}
	// The verification link started a session too.
	if len(list) != 3 {
		t.Fatalf("sessions = %d, want 3", len(list))
	}
	var laptopID, phoneID uuid.UUID
	for _, s := range list {
		switch s.UserAgent {
		case "Firefox":
			laptopID = s.ID
			if s.IP != "10.0.0.1" {
				t.Errorf("laptop ip = %q", s.IP)
			}
		case "Safari":
			phoneID = s.ID
		}
	}
	if current != laptopID || laptopID == uuid.Nil {
		t.Errorf("current = %v, laptop = %v", current, laptopID)
	}

	var ve *domain.ValidationError
	if err := e.svc.RevokeSession(laptop, u.ID, laptopID, lt); !errors.As(err, &ve) {
		t.Errorf("revoke current err = %v", err)
	}
	if err := e.svc.RevokeSession(laptop, u.ID, phoneID, lt); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Authenticate(phone, pt); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("revoked session err = %v", err)
	}
	if err := e.svc.RevokeOtherSessions(laptop, u.ID, lt); err != nil {
		t.Fatal(err)
	}
	if list, _, _ := e.svc.Sessions(laptop, u.ID, lt); len(list) != 1 || list[0].ID != laptopID {
		t.Errorf("after revoking others = %+v", list)
	}
}

func TestAuthenticateTouchesStaleSession(t *testing.T) {
	e := newTestEnv(t)
	e.registerVerified(t, "a@b.co", "password123")
	token, sess, err := e.svc.Login(context.Background(), "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	start := sess.LastUsedAt
	later := domain.WithClient(context.Background(), domain.Client{IP: "10.0.0.9"})

	e.svc.now = func() time.Time { return start.Add(time.Minute) }
	if _, err := e.svc.Authenticate(later, token); err != nil {
		t.Fatal(err)
	}
	if sess.LastUsedAt != start {
		t.Error("touched a fresh session")
	}
	e.svc.now = func() time.Time { return start.Add(10 * time.Minute) }
	if _, err := e.svc.Authenticate(later, token); err != nil {
		t.Fatal(err)
	}
	if !sess.LastUsedAt.Equal(start.Add(10*time.Minute)) || sess.IP != "10.0.0.9" {
		t.Errorf("session = %+v", sess)
	}
}
