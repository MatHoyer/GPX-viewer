package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type AccountService interface {
	UpdateName(ctx context.Context, userID uuid.UUID, name string) (*domain.User, error)
	UpdateVisibility(ctx context.Context, userID uuid.UUID, v domain.Visibility) (*domain.User, error)
	UpdateLanguage(ctx context.Context, userID uuid.UUID, l domain.Language) (*domain.User, error)
}

type AccountHandler struct {
	svc AccountService
}

func NewAccountHandler(svc AccountService) *AccountHandler {
	return &AccountHandler{svc: svc}
}

func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	var in dto.UpdateAccount
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Name == nil && in.Visibility == nil && in.Language == nil {
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
	if in.Language != nil {
		if u, err = h.svc.UpdateLanguage(r.Context(), id, domain.Language(*in.Language)); err != nil {
			writeError(w, r, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, dto.NewUser(u))
}
