package handler

import (
	"context"
	"net/http"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/social"
)

type SocialService interface {
	Profile(ctx context.Context, viewer, id uuid.UUID) (*social.Profile, error)
	Search(ctx context.Context, viewer uuid.UUID, query string) ([]domain.User, error)
	Connections(ctx context.Context, viewer uuid.UUID) ([]domain.Connection, error)
	AddFriend(ctx context.Context, viewer, other uuid.UUID) (domain.Relation, error)
	RemoveFriend(ctx context.Context, viewer, other uuid.UUID) error
}

type SocialHandler struct {
	svc SocialService
}

func NewSocialHandler(svc SocialService) *SocialHandler {
	return &SocialHandler{svc: svc}
}

func (h *SocialHandler) Profile(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	p, err := h.svc.Profile(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.UserProfile{
		User:       dto.NewPublicUser(p.User),
		Visibility: string(p.User.Visibility),
		Relation:   string(p.Relation),
		CanView:    p.CanView,
	})
}

func (h *SocialHandler) Search(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.Search(r.Context(), middleware.UserFrom(r.Context()).ID, r.URL.Query().Get("q"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewPublicUsers(users))
}

func (h *SocialHandler) Friends(w http.ResponseWriter, r *http.Request) {
	cs, err := h.svc.Connections(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewConnections(cs))
}

// AddFriend sends a friend request to the user in the URL, or accepts theirs.
func (h *SocialHandler) AddFriend(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rel, err := h.svc.AddFriend(r.Context(), middleware.UserFrom(r.Context()).ID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.Relation{Relation: string(rel)})
}

// RemoveFriend unfriends, cancels or declines, whichever applies.
func (h *SocialHandler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.svc.RemoveFriend(r.Context(), middleware.UserFrom(r.Context()).ID, id); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
