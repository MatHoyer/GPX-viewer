package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Comment is a message left on a hike.
type Comment struct {
	ID        uuid.UUID
	HikeID    uuid.UUID
	UserID    uuid.UUID
	Body      string
	CreatedAt time.Time
	// Author is loaded by ListComments.
	Author *User
}

// HikeInteractions sums up the kudos and comments on a hike for one viewer.
type HikeInteractions struct {
	Kudos    int
	Comments int
	// Kudoed is whether the viewer gave kudos.
	Kudoed bool
}

type InteractionRepository interface {
	// Counts returns the interactions on each of hikeIDs, as seen by viewer.
	Counts(ctx context.Context, viewer uuid.UUID, hikeIDs []uuid.UUID) (map[uuid.UUID]HikeInteractions, error)
	// AddKudos is a no-op when userID already gave kudos.
	AddKudos(ctx context.Context, hikeID, userID uuid.UUID, at time.Time) error
	RemoveKudos(ctx context.Context, hikeID, userID uuid.UUID) error
	// ListComments returns a hike's comments with their authors, oldest first.
	ListComments(ctx context.Context, hikeID uuid.UUID) ([]Comment, error)
	CreateComment(ctx context.Context, c *Comment) error
	GetComment(ctx context.Context, hikeID, id uuid.UUID) (*Comment, error)
	DeleteComment(ctx context.Context, id uuid.UUID) error
}
