// Package summit matches hikes against known peaks.
package summit

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// RadiusM is how close a track must pass to a peak to count as reaching it.
const RadiusM = 50

// Hikes checks that a viewer may see a hike.
type Hikes interface {
	Get(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, error)
}

type Service struct {
	peaks  domain.PeakRepository
	source domain.PeakSource
	hikes  Hikes
}

func NewService(peaks domain.PeakRepository, source domain.PeakSource, hikes Hikes) *Service {
	return &Service{peaks: peaks, source: source, hikes: hikes}
}

// OnHike returns the peaks a hike went over, if viewer may see it.
func (s *Service) OnHike(ctx context.Context, viewer, id uuid.UUID) ([]domain.Peak, error) {
	if _, err := s.hikes.Get(ctx, viewer, id); err != nil {
		return nil, err
	}
	return s.peaks.OnHike(ctx, id, RadiusM)
}

// OfUser returns every peak a user reached on their own or tagged hikes.
func (s *Service) OfUser(ctx context.Context, userID uuid.UUID) ([]domain.Summit, error) {
	return s.peaks.OfUser(ctx, userID, RadiusM)
}

// Import fetches the named peaks inside bbox and stores them, returning how many.
func (s *Service) Import(ctx context.Context, bbox domain.Bounds) (int, error) {
	if bbox.MinLon >= bbox.MaxLon || bbox.MinLat >= bbox.MaxLat {
		return 0, fmt.Errorf("empty bounding box %+v", bbox)
	}
	peaks, err := s.source.Peaks(ctx, bbox)
	if err != nil {
		return 0, err
	}
	return len(peaks), s.peaks.Upsert(ctx, peaks)
}
