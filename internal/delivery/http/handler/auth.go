package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type AuthService interface {
	Register(ctx context.Context, email, password string) (*domain.User, error)
	Login(ctx context.Context, email, password string) (string, *domain.Session, error)
	Logout(ctx context.Context, token string) error
	VerifyEmail(ctx context.Context, token string) (string, *domain.Session, error)
	RequestPasswordReset(ctx context.Context, email string) error
	ResetPassword(ctx context.Context, token, password string) (string, *domain.Session, error)
	ChangePassword(ctx context.Context, userID uuid.UUID, current, password string) (string, *domain.Session, error)
}

type AuthHandler struct {
	svc          AuthService
	cookieSecure bool
}

func NewAuthHandler(svc AuthService, cookieSecure bool) *AuthHandler {
	return &AuthHandler{svc: svc, cookieSecure: cookieSecure}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var in dto.Credentials
	if !decodeJSON(w, r, &in) {
		return
	}
	u, err := h.svc.Register(r.Context(), in.Email, in.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}
	// No session until the email is verified.
	writeJSON(w, http.StatusCreated, dto.NewUser(u))
}

// VerifyEmail consumes the token from the emailed link and signs the user in.
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var in dto.VerifyEmail
	if !decodeJSON(w, r, &in) {
		return
	}
	token, sess, err := h.svc.VerifyEmail(r.Context(), in.Token)
	if err != nil {
		writeError(w, r, err)
		return
	}
	h.setCookie(w, token, sess.ExpiresAt)
	w.WriteHeader(http.StatusNoContent)
}

// ForgotPassword emails a reset link. It answers the same whether or not the
// email belongs to an account.
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var in dto.ForgotPassword
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.svc.RequestPasswordReset(r.Context(), in.Email); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ResetPassword consumes the token from the emailed link, sets the new
// password and signs the user in.
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var in dto.ResetPassword
	if !decodeJSON(w, r, &in) {
		return
	}
	token, sess, err := h.svc.ResetPassword(r.Context(), in.Token, in.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}
	h.setCookie(w, token, sess.ExpiresAt)
	w.WriteHeader(http.StatusNoContent)
}

// ChangePassword sets a new password for the signed-in user. Other sessions
// are signed out; this one gets a fresh cookie.
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var in dto.ChangePassword
	if !decodeJSON(w, r, &in) {
		return
	}
	id := middleware.UserFrom(r.Context()).ID
	token, sess, err := h.svc.ChangePassword(r.Context(), id, in.CurrentPassword, in.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}
	h.setCookie(w, token, sess.ExpiresAt)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var in dto.Credentials
	if !decodeJSON(w, r, &in) {
		return
	}
	token, sess, err := h.svc.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		writeError(w, r, err)
		return
	}
	h.setCookie(w, token, sess.ExpiresAt)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(middleware.SessionCookie); err == nil {
		if err := h.svc.Logout(r.Context(), c.Value); err != nil {
			writeError(w, r, err)
			return
		}
	}
	h.setCookie(w, "", time.Unix(0, 0))
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, dto.NewUser(middleware.UserFrom(r.Context())))
}

func (h *AuthHandler) setCookie(w http.ResponseWriter, value string, expires time.Time) {
	c := &http.Cookie{
		Name:     middleware.SessionCookie,
		Value:    value,
		Path:     "/",
		Expires:  expires,
		HttpOnly: true,
		Secure:   h.cookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
	if value == "" {
		c.MaxAge = -1
	}
	http.SetCookie(w, c)
}
