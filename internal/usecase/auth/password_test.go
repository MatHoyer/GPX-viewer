package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestPasswordReset(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u := e.registerVerified(t, "a@b.co", "password123")
	old, _, err := e.svc.Login(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}

	if err := e.svc.RequestPasswordReset(ctx, " A@b.co "); err != nil {
		t.Fatal(err)
	}
	if got := e.mailer.sent[len(e.mailer.sent)-1]; got.to != "a@b.co" || got.subject != "Reset your password" {
		t.Fatalf("sent = %+v", got)
	}
	token := e.mailer.lastToken(t)

	var ve *domain.ValidationError
	if _, _, err := e.svc.ResetPassword(ctx, token, "short"); !errors.As(err, &ve) || ve.Field != "password" {
		t.Fatalf("short password err = %v", err)
	}

	// The rejected password did not use up the link.
	session, _, err := e.svc.ResetPassword(ctx, token, "new-password")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := e.svc.Authenticate(ctx, session); err != nil || got.ID != u.ID {
		t.Fatalf("new session: %v, %v", got, err)
	}
	if _, err := e.svc.Authenticate(ctx, old); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("old session err = %v", err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "password123"); !errors.Is(err, domain.ErrInvalidCredentials) {
		t.Errorf("old password err = %v", err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "new-password"); err != nil {
		t.Errorf("new password err = %v", err)
	}
	if _, _, err := e.svc.ResetPassword(ctx, token, "another-password"); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("reused token err = %v", err)
	}
}

func TestPasswordResetUnknownEmail(t *testing.T) {
	e := newTestEnv(t)
	if err := e.svc.RequestPasswordReset(context.Background(), "nobody@b.co"); err != nil {
		t.Fatal(err)
	}
	if len(e.mailer.sent) != 0 {
		t.Fatalf("sent = %+v", e.mailer.sent)
	}
}

func TestPasswordResetCooldown(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.registerVerified(t, "a@b.co", "password123")
	e.mailer.sent = nil

	for range 3 {
		if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
			t.Fatal(err)
		}
	}
	if len(e.mailer.sent) != 1 {
		t.Fatalf("sent %d emails within the cooldown, want 1", len(e.mailer.sent))
	}
	first := e.mailer.lastToken(t)

	e.svc.now = func() time.Time { return time.Now().Add(PasswordResetCooldown + time.Second) }
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	if len(e.mailer.sent) != 2 {
		t.Fatalf("sent %d emails after the cooldown, want 2", len(e.mailer.sent))
	}
	if _, _, err := e.svc.ResetPassword(ctx, first, "new-password"); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("superseded token err = %v", err)
	}
}

func TestPasswordResetExpired(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.registerVerified(t, "a@b.co", "password123")
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	e.svc.now = func() time.Time { return time.Now().Add(PasswordResetTTL + time.Minute) }
	if _, _, err := e.svc.ResetPassword(ctx, e.mailer.lastToken(t), "new-password"); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("expired token err = %v", err)
	}
}

func TestPasswordResetFailedSendKeepsNoCooldown(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	e.registerVerified(t, "a@b.co", "password123")
	e.mailer.err = errors.New("smtp down")
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err == nil {
		t.Fatal("want send error")
	}
	e.mailer.err = nil
	e.mailer.sent = nil
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	if len(e.mailer.sent) != 1 {
		t.Fatalf("sent %d emails, want 1", len(e.mailer.sent))
	}
}

// Following a reset link proves the address, so it also verifies it.
func TestPasswordResetVerifiesEmail(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	if _, err := e.svc.Register(ctx, "a@b.co", "password123", ""); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.ResetPassword(ctx, e.mailer.lastToken(t), "new-password"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "new-password"); err != nil {
		t.Errorf("login err = %v", err)
	}
}

func TestChangePassword(t *testing.T) {
	ctx := context.Background()
	e := newTestEnv(t)
	u := e.registerVerified(t, "a@b.co", "password123")
	old, _, err := e.svc.Login(ctx, "a@b.co", "password123")
	if err != nil {
		t.Fatal(err)
	}
	if err := e.svc.RequestPasswordReset(ctx, "a@b.co"); err != nil {
		t.Fatal(err)
	}
	pendingReset := e.mailer.lastToken(t)

	var ve *domain.ValidationError
	if _, _, err := e.svc.ChangePassword(ctx, u.ID, "wrong-password", "new-password"); !errors.As(err, &ve) || ve.Field != "currentPassword" {
		t.Fatalf("wrong current err = %v", err)
	}
	if _, _, err := e.svc.ChangePassword(ctx, u.ID, "password123", "short"); !errors.As(err, &ve) || ve.Field != "password" {
		t.Fatalf("short password err = %v", err)
	}

	session, _, err := e.svc.ChangePassword(ctx, u.ID, "password123", "new-password")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Authenticate(ctx, session); err != nil {
		t.Errorf("new session err = %v", err)
	}
	if _, err := e.svc.Authenticate(ctx, old); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("old session err = %v", err)
	}
	if _, _, err := e.svc.Login(ctx, "a@b.co", "new-password"); err != nil {
		t.Errorf("new password err = %v", err)
	}
	if _, _, err := e.svc.ResetPassword(ctx, pendingReset, "other-password"); !errors.Is(err, domain.ErrInvalidToken) {
		t.Errorf("pending reset err = %v", err)
	}
}
