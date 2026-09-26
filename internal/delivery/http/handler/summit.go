package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type SummitService interface {
	OnHike(ctx context.Context, viewer, id uuid.UUID) ([]domain.Peak, error)
	OfUser(ctx context.Context, userID uuid.UUID) ([]domain.Summit, error)
}

type SummitHandler struct {
	svc SummitService
}

func NewSummitHandler(svc SummitService) *SummitHandler { return &SummitHandler{svc: svc} }

// OnHike returns the peaks the hike in the URL went over.
func (h *SummitHandler) OnHike(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	peaks, err := h.svc.OnHike(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewPeaks(peaks))
}

// Mine returns every peak the signed-in user reached, with the hikes that did.
func (h *SummitHandler) Mine(w http.ResponseWriter, r *http.Request) {
	summits, err := h.svc.OfUser(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewSummits(summits))
}
