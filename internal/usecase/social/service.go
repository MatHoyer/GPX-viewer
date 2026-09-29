// Package social manages friendships and decides who can see whose profile.
package social

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Profile is a user as seen by a viewer. CanView tells whether the viewer
// may see their hikes; the user card itself is shown to any signed-in user.
type Profile struct {
	User     *domain.User
	Relation domain.Relation
	CanView  bool
}

// Service methods identify the viewer by id; uuid.Nil is an anonymous visitor.
type Service struct {
	users   domain.UserDirectory
	friends domain.FriendshipRepository
	now     func() time.Time
}

func NewService(users domain.UserDirectory, friends domain.FriendshipRepository) *Service {
	return &Service{users: users, friends: friends, now: time.Now}
}

// Profile returns the user as seen by viewer. Anonymous visitors only see
// public profiles; anything else is reported as not found.
func (s *Service) Profile(ctx context.Context, viewer, id uuid.UUID) (*Profile, error) {
	u, err := s.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	rel, err := s.relation(ctx, viewer, id)
	if err != nil {
		return nil, err
	}
	canView := canView(u.Visibility, rel)
	if viewer == uuid.Nil && !canView {
		return nil, domain.ErrNotFound
	}
	return &Profile{User: u, Relation: rel, CanView: canView}, nil
}

// CanView reports whether viewer may see owner's hikes.
func (s *Service) CanView(ctx context.Context, viewer, owner uuid.UUID) (bool, error) {
	if viewer == owner {
		return true, nil
	}
	u, err := s.users.GetByID(ctx, owner)
	if errors.Is(err, domain.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if u.Visibility == domain.VisibilityPublic {
		return true, nil
	}
	rel, err := s.relation(ctx, viewer, owner)
	if err != nil {
		return false, err
	}
	return canView(u.Visibility, rel), nil
}

// AreFriends reports whether a and b have an accepted friendship.
func (s *Service) AreFriends(ctx context.Context, a, b uuid.UUID) (bool, error) {
	rel, err := s.relation(ctx, a, b)
	return rel == domain.RelationFriends, err
}

func (s *Service) Connections(ctx context.Context, viewer uuid.UUID) ([]domain.Connection, error) {
	return s.friends.ListConnections(ctx, viewer)
}

// AddFriend sends a friend request, or accepts the one other already sent.
func (s *Service) AddFriend(ctx context.Context, viewer, other uuid.UUID) (domain.Relation, error) {
	if viewer == other {
		return "", &domain.ValidationError{Field: "user", Message: "you cannot befriend yourself", Code: "self_friend"}
	}
	f, err := s.friends.Get(ctx, viewer, other)
	if errors.Is(err, domain.ErrNotFound) {
		err = s.friends.Create(ctx, &domain.Friendship{RequesterID: viewer, AddresseeID: other, CreatedAt: s.now()})
		if errors.Is(err, domain.ErrConflict) {
			// The other side sent a request concurrently; act on it.
			return s.AddFriend(ctx, viewer, other)
		}
		if err != nil {
			return "", err
		}
		return domain.RelationOutgoing, nil
	}
	if err != nil {
		return "", err
	}
	if f.RelationFor(viewer) == domain.RelationIncoming {
		if err := s.friends.Accept(ctx, other, viewer, s.now()); err != nil {
			return "", err
		}
		return domain.RelationFriends, nil
	}
	return f.RelationFor(viewer), nil
}

// RemoveFriend unfriends, cancels a sent request or declines a received one.
func (s *Service) RemoveFriend(ctx context.Context, viewer, other uuid.UUID) error {
	return s.friends.Delete(ctx, viewer, other)
}

func (s *Service) relation(ctx context.Context, viewer, other uuid.UUID) (domain.Relation, error) {
	switch viewer {
	case other:
		return domain.RelationSelf, nil
	case uuid.Nil:
		return domain.RelationNone, nil
	}
	f, err := s.friends.Get(ctx, viewer, other)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.RelationNone, nil
	}
	if err != nil {
		return "", err
	}
	return f.RelationFor(viewer), nil
}

func canView(v domain.Visibility, rel domain.Relation) bool {
	switch {
	case rel == domain.RelationSelf, v == domain.VisibilityPublic:
		return true
	case v == domain.VisibilityFriends:
		return rel == domain.RelationFriends
	}
	return false
}
