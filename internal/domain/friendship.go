package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Relation is how a user relates to another, from the viewer's side.
type Relation string

const (
	RelationNone     Relation = "none"
	RelationSelf     Relation = "self"
	RelationFriends  Relation = "friends"
	RelationOutgoing Relation = "outgoing" // the viewer sent a pending request
	RelationIncoming Relation = "incoming" // the viewer received a pending request
)

// Friendship is a request from Requester to Addressee, accepted or not.
type Friendship struct {
	RequesterID uuid.UUID
	AddresseeID uuid.UUID
	Accepted    bool
	CreatedAt   time.Time
}

// RelationFor returns the friendship as seen by viewer.
func (f *Friendship) RelationFor(viewer uuid.UUID) Relation {
	switch {
	case f == nil:
		return RelationNone
	case f.Accepted:
		return RelationFriends
	case f.RequesterID == viewer:
		return RelationOutgoing
	default:
		return RelationIncoming
	}
}

// Connection is another user linked to the viewer by a friendship.
type Connection struct {
	User     User
	Relation Relation
	Since    time.Time
}

type FriendshipRepository interface {
	// Get returns the friendship between a and b in either direction.
	Get(ctx context.Context, a, b uuid.UUID) (*Friendship, error)
	// Create fails with ErrConflict when a friendship between the pair exists.
	Create(ctx context.Context, f *Friendship) error
	Accept(ctx context.Context, requesterID, addresseeID uuid.UUID, at time.Time) error
	// Delete removes the friendship between a and b in either direction.
	Delete(ctx context.Context, a, b uuid.UUID) error
	ListConnections(ctx context.Context, userID uuid.UUID) ([]Connection, error)
}
