package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type AuthService interface {
	Register(ctx context.Context, email, password string) (*domain.User, error)
	Login(ctx context.Context, email, password string) (string, *domain.Session, error)
	Logout(ctx context.Context, token string) error
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
	if !h.startSession(w, r, in) {
		return
	}
	writeJSON(w, http.StatusCreated, dto.NewUser(u))
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

func (h *AuthHandler) startSession(w http.ResponseWriter, r *http.Request, in dto.Credentials) bool {
	token, sess, err := h.svc.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		writeError(w, r, err)
		return false
	}
	h.setCookie(w, token, sess.ExpiresAt)
	return true
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
