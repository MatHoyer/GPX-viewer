// Package interaction handles kudos and comments on hikes.
package interaction

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// MaxCommentLength bounds comments, in characters.
const MaxCommentLength = 2000

// Hikes checks that a viewer may see a hike.
type Hikes interface {
	Get(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, error)
}

type Service struct {
	repo  domain.InteractionRepository
	hikes Hikes
	now   func() time.Time
}

func NewService(repo domain.InteractionRepository, hikes Hikes) *Service {
	return &Service{repo: repo, hikes: hikes, now: time.Now}
}

// Counts returns kudos and comment counts for hikes the caller already shows viewer.
func (s *Service) Counts(ctx context.Context, viewer uuid.UUID, hikeIDs []uuid.UUID) (map[uuid.UUID]domain.HikeInteractions, error) {
	return s.repo.Counts(ctx, viewer, hikeIDs)
}

// SetKudos gives or takes back userID's kudos on a hike they can see.
func (s *Service) SetKudos(ctx context.Context, userID, hikeID uuid.UUID, on bool) error {
	if _, err := s.hikes.Get(ctx, userID, hikeID); err != nil {
		return err
	}
	if on {
		return s.repo.AddKudos(ctx, hikeID, userID, s.now().UTC())
	}
	return s.repo.RemoveKudos(ctx, hikeID, userID)
}

// Comments returns a hike's comments, if viewer can see it.
func (s *Service) Comments(ctx context.Context, viewer, hikeID uuid.UUID) ([]domain.Comment, error) {
	if _, err := s.hikes.Get(ctx, viewer, hikeID); err != nil {
		return nil, err
	}
	return s.repo.ListComments(ctx, hikeID)
}

// Comment posts userID's comment on a hike they can see.
func (s *Service) Comment(ctx context.Context, userID, hikeID uuid.UUID, body string) (*domain.Comment, error) {
	if _, err := s.hikes.Get(ctx, userID, hikeID); err != nil {
		return nil, err
	}
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, &domain.ValidationError{Field: "body", Message: "must not be empty"}
	}
	if utf8.RuneCountInString(body) > MaxCommentLength {
		return nil, &domain.ValidationError{Field: "body", Message: fmt.Sprintf("must be at most %d characters", MaxCommentLength)}
	}
	c := &domain.Comment{ID: uuid.New(), HikeID: hikeID, UserID: userID, Body: body, CreatedAt: s.now().UTC()}
	if err := s.repo.CreateComment(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// DeleteComment removes a comment. Its author and the hike's owner may.
func (s *Service) DeleteComment(ctx context.Context, userID, hikeID, commentID uuid.UUID) error {
	h, err := s.hikes.Get(ctx, userID, hikeID)
	if err != nil {
		return err
	}
	c, err := s.repo.GetComment(ctx, hikeID, commentID)
	if err != nil {
		return err
	}
	if c.UserID != userID && h.UserID != userID {
		return domain.ErrNotFound
	}
	return s.repo.DeleteComment(ctx, commentID)
}
