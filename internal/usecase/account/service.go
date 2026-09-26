package account

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const MaxNameLength = 100

type Service struct {
	users domain.AccountRepository
}

func NewService(users domain.AccountRepository) *Service {
	return &Service{users: users}
}

// UpdateName sets the display name; an empty name clears it.
func (s *Service) UpdateName(ctx context.Context, userID uuid.UUID, name string) (*domain.User, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > MaxNameLength {
		return nil, &domain.ValidationError{Field: "name", Message: fmt.Sprintf("must be at most %d characters", MaxNameLength)}
	}
	if err := s.users.UpdateName(ctx, userID, name); err != nil {
		return nil, err
	}
	return s.users.GetByID(ctx, userID)
}

// UpdateVisibility sets who can see the user's profile and hikes.
func (s *Service) UpdateVisibility(ctx context.Context, userID uuid.UUID, v domain.Visibility) (*domain.User, error) {
	if !v.Valid() {
		return nil, &domain.ValidationError{Field: "visibility", Message: "must be private, friends or public"}
	}
	if err := s.users.UpdateVisibility(ctx, userID, v); err != nil {
		return nil, err
	}
	return s.users.GetByID(ctx, userID)
}
