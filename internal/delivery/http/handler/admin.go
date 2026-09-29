package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/admin"
)

type AdminService interface {
	ListUsers(ctx context.Context, query string, page int) (*admin.UserPage, error)
	GetUser(ctx context.Context, id uuid.UUID) (*domain.AdminUser, error)
	Sessions(ctx context.Context, userID uuid.UUID) ([]domain.Session, error)
	RevokeSession(ctx context.Context, userID, id uuid.UUID) error
	RevokeSessions(ctx context.Context, userID uuid.UUID) error
	Invite(ctx context.Context, email, name string, lang domain.Language, send bool) (*domain.User, string, bool, error)
	PasswordLink(ctx context.Context, userID uuid.UUID, send bool) (string, bool, error)
	SetEmailVerified(ctx context.Context, actorID, targetID uuid.UUID, verified bool) error
	RevokeInvite(ctx context.Context, targetID uuid.UUID) error
	Ban(ctx context.Context, actorID, targetID uuid.UUID, reason string) error
	Unban(ctx context.Context, targetID uuid.UUID) error
	SetAdmin(ctx context.Context, actorID, targetID uuid.UUID, admin bool) error
}

// RegistrationSettings reports whether visitors can sign up.
type RegistrationSettings interface {
	RegistrationEnabled() bool
	EmailEnabled() bool
	RegistrationOpen(ctx context.Context) (bool, error)
}

type AdminHandler struct {
	svc          AdminService
	registration RegistrationSettings
}

func NewAdminHandler(svc AdminService, registration RegistrationSettings) *AdminHandler {
	return &AdminHandler{svc: svc, registration: registration}
}

// Config tells any visitor, signed in or not, how the instance is set up.
func (h *AdminHandler) Config(w http.ResponseWriter, r *http.Request) {
	open, err := h.registration.RegistrationOpen(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.Config{
		RegistrationEnabled: h.registration.RegistrationEnabled(),
		RegistrationOpen:    open,
		EmailEnabled:        h.registration.EmailEnabled(),
	})
}

// Users lists a page of users; ?q= searches emails and names, ?page= starts at 1.
func (h *AdminHandler) Users(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	page = max(page, 1)
	p, err := h.svc.ListUsers(r.Context(), r.URL.Query().Get("q"), page)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.UserPage{Users: dto.NewAdminUsers(p.Users), Total: p.Total, Page: page, PageSize: admin.PageSize})
}

func (h *AdminHandler) User(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	u, err := h.svc.GetUser(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewAdminUser(u))
}

func (h *AdminHandler) Sessions(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	ss, err := h.svc.Sessions(r.Context(), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewSessions(ss, uuid.Nil))
}

// RevokeSession signs the user out of one device.
func (h *AdminHandler) RevokeSession(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	sessionID, ok := parseParam(w, r, "sessionId")
	if !ok {
		return
	}
	h.respond(w, r, h.svc.RevokeSession(r.Context(), id, sessionID))
}

// RevokeSessions signs the user out everywhere; they can sign in again.
func (h *AdminHandler) RevokeSessions(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, h.svc.RevokeSessions(r.Context(), id))
}

// CreateUser invites someone, whether or not registration is enabled.
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var in dto.CreateUser
	if !decodeJSON(w, r, &in) {
		return
	}
	// Until they pick one, invitees get the language of the admin inviting them.
	lang := middleware.UserFrom(r.Context()).Language
	u, link, sent, err := h.svc.Invite(r.Context(), in.Email, in.Name, lang, in.SendEmail)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dto.CreatedUser{
		User:   dto.NewAdminUser(&domain.AdminUser{User: *u}),
		Invite: dto.Invite{Link: link, EmailSent: sent},
	})
}

// PasswordLink issues a link where the user chooses a password: their invite
// while it is pending, otherwise a password reset.
func (h *AdminHandler) PasswordLink(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var in dto.SendInvite
	if !decodeJSON(w, r, &in) {
		return
	}
	link, sent, err := h.svc.PasswordLink(r.Context(), id, in.SendEmail)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.Invite{Link: link, EmailSent: sent})
}

// RevokeInvite deletes the account of a user who has not accepted their invite.
func (h *AdminHandler) RevokeInvite(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, h.svc.RevokeInvite(r.Context(), id))
}

func (h *AdminHandler) Verify(w http.ResponseWriter, r *http.Request) {
	h.setVerified(w, r, true)
}

func (h *AdminHandler) Unverify(w http.ResponseWriter, r *http.Request) {
	h.setVerified(w, r, false)
}

func (h *AdminHandler) setVerified(w http.ResponseWriter, r *http.Request, verified bool) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, h.svc.SetEmailVerified(r.Context(), middleware.UserFrom(r.Context()).ID, id, verified))
}

func (h *AdminHandler) Ban(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var in dto.BanUser
	if !decodeJSON(w, r, &in) {
		return
	}
	h.respond(w, r, h.svc.Ban(r.Context(), middleware.UserFrom(r.Context()).ID, id, in.Reason))
}

func (h *AdminHandler) Unban(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, h.svc.Unban(r.Context(), id))
}

func (h *AdminHandler) Promote(w http.ResponseWriter, r *http.Request) {
	h.setAdmin(w, r, true)
}

func (h *AdminHandler) Demote(w http.ResponseWriter, r *http.Request) {
	h.setAdmin(w, r, false)
}

func (h *AdminHandler) setAdmin(w http.ResponseWriter, r *http.Request, admin bool) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.respond(w, r, h.svc.SetAdmin(r.Context(), middleware.UserFrom(r.Context()).ID, id, admin))
}

func (h *AdminHandler) respond(w http.ResponseWriter, r *http.Request, err error) {
	if err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
