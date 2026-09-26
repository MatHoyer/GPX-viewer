package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type InteractionService interface {
	Counts(ctx context.Context, viewer uuid.UUID, hikeIDs []uuid.UUID) (map[uuid.UUID]domain.HikeInteractions, error)
	SetKudos(ctx context.Context, userID, hikeID uuid.UUID, on bool) error
	Comments(ctx context.Context, viewer, hikeID uuid.UUID) ([]domain.Comment, error)
	Comment(ctx context.Context, userID, hikeID uuid.UUID, body string) (*domain.Comment, error)
	DeleteComment(ctx context.Context, userID, hikeID, commentID uuid.UUID) error
}

type InteractionHandler struct {
	svc InteractionService
}

func NewInteractionHandler(svc InteractionService) *InteractionHandler {
	return &InteractionHandler{svc: svc}
}

func (h *InteractionHandler) GiveKudos(w http.ResponseWriter, r *http.Request) { h.kudos(w, r, true) }

func (h *InteractionHandler) TakeKudos(w http.ResponseWriter, r *http.Request) { h.kudos(w, r, false) }

func (h *InteractionHandler) kudos(w http.ResponseWriter, r *http.Request, on bool) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.svc.SetKudos(r.Context(), middleware.UserFrom(r.Context()).ID, id, on); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *InteractionHandler) Comments(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	comments, err := h.svc.Comments(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	out := make([]dto.Comment, len(comments))
	for i := range comments {
		out[i] = dto.NewComment(&comments[i])
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *InteractionHandler) PostComment(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var in dto.NewCommentRequest
	if !decodeJSON(w, r, &in) {
		return
	}
	user := middleware.UserFrom(r.Context())
	c, err := h.svc.Comment(r.Context(), user.ID, id, in.Body)
	if err != nil {
		writeError(w, r, err)
		return
	}
	c.Author = user
	writeJSON(w, http.StatusCreated, dto.NewComment(c))
}

func (h *InteractionHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	commentID, ok := parseParam(w, r, "commentId")
	if !ok {
		return
	}
	if err := h.svc.DeleteComment(r.Context(), middleware.UserFrom(r.Context()).ID, id, commentID); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
