package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type AdminService interface {
	ListUsers(ctx context.Context) ([]domain.AdminUser, error)
	Invite(ctx context.Context, email, name string, send bool) (*domain.User, string, bool, error)
	ReissueInvite(ctx context.Context, userID uuid.UUID, send bool) (string, bool, error)
	Ban(ctx context.Context, actorID, targetID uuid.UUID, reason string) error
	Unban(ctx context.Context, targetID uuid.UUID) error
	SetAdmin(ctx context.Context, actorID, targetID uuid.UUID, admin bool) error
}

// RegistrationSettings reports whether visitors can sign up.
type RegistrationSettings interface {
	RegistrationEnabled() bool
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
	writeJSON(w, http.StatusOK, dto.Config{RegistrationEnabled: h.registration.RegistrationEnabled(), RegistrationOpen: open})
}

func (h *AdminHandler) Users(w http.ResponseWriter, r *http.Request) {
	us, err := h.svc.ListUsers(r.Context())
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewAdminUsers(us))
}

// CreateUser invites someone, whether or not registration is enabled.
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var in dto.CreateUser
	if !decodeJSON(w, r, &in) {
		return
	}
	u, link, sent, err := h.svc.Invite(r.Context(), in.Email, in.Name, in.SendEmail)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, dto.CreatedUser{
		User:   dto.NewAdminUser(&domain.AdminUser{User: *u}),
		Invite: dto.Invite{Link: link, EmailSent: sent},
	})
}

// Invite issues a new invite link for a user who has not signed in yet.
func (h *AdminHandler) Invite(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var in dto.SendInvite
	if !decodeJSON(w, r, &in) {
		return
	}
	link, sent, err := h.svc.ReissueInvite(r.Context(), id, in.SendEmail)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.Invite{Link: link, EmailSent: sent})
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
