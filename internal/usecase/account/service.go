package account

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const (
	MaxNameLength  = 100
	MaxAvatarBytes = 2 << 20
)

// Only raster formats: an SVG avatar could carry script.
var avatarTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
	"image/gif":  true,
}

type Service struct {
	users domain.AccountRepository
	now   func() time.Time
}

func NewService(users domain.AccountRepository) *Service {
	return &Service{users: users, now: time.Now}
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

// SetAvatar stores an uploaded image, sniffing its type from the content.
func (s *Service) SetAvatar(ctx context.Context, userID uuid.UUID, data []byte) (*domain.User, error) {
	if len(data) == 0 {
		return nil, &domain.ValidationError{Field: "avatar", Message: "image is empty"}
	}
	if len(data) > MaxAvatarBytes {
		return nil, &domain.ValidationError{Field: "avatar", Message: fmt.Sprintf("must be at most %d MB", MaxAvatarBytes>>20)}
	}
	contentType := http.DetectContentType(data)
	if !avatarTypes[contentType] {
		return nil, &domain.ValidationError{Field: "avatar", Message: "must be a PNG, JPEG, WebP or GIF image"}
	}
	a := &domain.Avatar{ContentType: contentType, Data: data, UpdatedAt: s.now()}
	if err := s.users.SetAvatar(ctx, userID, a); err != nil {
		return nil, err
	}
	return s.users.GetByID(ctx, userID)
}

func (s *Service) DeleteAvatar(ctx context.Context, userID uuid.UUID) (*domain.User, error) {
	if err := s.users.DeleteAvatar(ctx, userID); err != nil {
		return nil, err
	}
	return s.users.GetByID(ctx, userID)
}

func (s *Service) Avatar(ctx context.Context, userID uuid.UUID) (*domain.Avatar, error) {
	return s.users.GetAvatar(ctx, userID)
}
