package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type AccountService interface {
	UpdateName(ctx context.Context, userID uuid.UUID, name string) (*domain.User, error)
	UpdateVisibility(ctx context.Context, userID uuid.UUID, v domain.Visibility) (*domain.User, error)
	SetAvatar(ctx context.Context, userID uuid.UUID, data []byte) (*domain.User, error)
	DeleteAvatar(ctx context.Context, userID uuid.UUID) (*domain.User, error)
	Avatar(ctx context.Context, userID uuid.UUID) (*domain.Avatar, error)
}

type AccountHandler struct {
	svc           AccountService
	maxAvatarSize int64
}

func NewAccountHandler(svc AccountService, maxAvatarSize int64) *AccountHandler {
	return &AccountHandler{svc: svc, maxAvatarSize: maxAvatarSize}
}

func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	var in dto.UpdateAccount
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Name == nil && in.Visibility == nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "nothing to update"})
		return
	}
	id := middleware.UserFrom(r.Context()).ID
	var u *domain.User
	var err error
	if in.Name != nil {
		if u, err = h.svc.UpdateName(r.Context(), id, *in.Name); err != nil {
			writeError(w, r, err)
			return
		}
	}
	if in.Visibility != nil {
		if u, err = h.svc.UpdateVisibility(r.Context(), id, domain.Visibility(*in.Visibility)); err != nil {
			writeError(w, r, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, dto.NewUser(u))
}

// UploadAvatar replaces the avatar with the multipart "avatar" file.
func (h *AccountHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	// Headroom for the multipart envelope; the service enforces the real limit.
	r.Body = http.MaxBytesReader(w, r.Body, h.maxAvatarSize+64<<10)
	file, _, err := r.FormFile("avatar")
	if _, tooBig := errors.AsType[*http.MaxBytesError](err); tooBig {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: fmt.Sprintf("must be at most %d MB", h.maxAvatarSize>>20), Field: "avatar"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "expected an image in the multipart \"avatar\" field", Field: "avatar"})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "failed to read upload", Field: "avatar"})
		return
	}
	u, err := h.svc.SetAvatar(r.Context(), middleware.UserFrom(r.Context()).ID, data)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewUser(u))
}

func (h *AccountHandler) DeleteAvatar(w http.ResponseWriter, r *http.Request) {
	u, err := h.svc.DeleteAvatar(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewUser(u))
}

// Avatar serves the uploaded image. URLs carry a version, so responses are immutable.
func (h *AccountHandler) Avatar(w http.ResponseWriter, r *http.Request) {
	a, err := h.svc.Avatar(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeAvatar(w, a)
}

func writeAvatar(w http.ResponseWriter, a *domain.Avatar) {
	w.Header().Set("Content-Type", a.ContentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(a.Data)))
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(a.Data)
}
