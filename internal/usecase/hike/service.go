package hike

import (
	"context"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// TrackTolerance is the simplification tolerance in degrees (~5m) used for map display.
const TrackTolerance = 0.00005

type Service struct {
	hikes  domain.HikeRepository
	parser domain.TrackParser
	now    func() time.Time
}

func NewService(hikes domain.HikeRepository, parser domain.TrackParser) *Service {
	return &Service{hikes: hikes, parser: parser, now: time.Now}
}

// Import parses a GPX file and stores it as a hike owned by userID.
func (s *Service) Import(ctx context.Context, userID uuid.UUID, filename string, data []byte) (*domain.Hike, error) {
	parsed, err := s.parser.Parse(data)
	if err != nil {
		return nil, err
	}
	if countPoints(parsed.Segments) < 2 {
		return nil, domain.ErrInvalidGPX
	}

	name := strings.TrimSpace(parsed.Name)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	}
	if name == "" {
		name = "Untitled hike"
	}

	h := &domain.Hike{
		ID:             uuid.New(),
		UserID:         userID,
		Name:           name,
		DistanceM:      parsed.DistanceM,
		ElevationGainM: parsed.ElevationGainM,
		StartedAt:      parsed.StartedAt,
		DurationS:      parsed.DurationS,
		Segments:       parsed.Segments,
		Bounds:         computeBounds(parsed.Segments),
		RawGPX:         data,
		CreatedAt:      s.now().UTC(),
	}
	if err := s.hikes.Create(ctx, h); err != nil {
		return nil, err
	}
	return h, nil
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]domain.Hike, error) {
	return s.hikes.ListByUser(ctx, userID)
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*domain.Hike, error) {
	return s.hikes.GetByID(ctx, userID, id)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.hikes.Delete(ctx, userID, id)
}

func (s *Service) Tracks(ctx context.Context, userID uuid.UUID) ([]domain.HikeTrack, error) {
	return s.hikes.ListTracks(ctx, userID, TrackTolerance)
}

func countPoints(segs []domain.Segment) int {
	n := 0
	for _, s := range segs {
		n += len(s)
	}
	return n
}

func computeBounds(segs []domain.Segment) domain.Bounds {
	b := domain.Bounds{MinLon: 180, MinLat: 90, MaxLon: -180, MaxLat: -90}
	for _, seg := range segs {
		for _, p := range seg {
			b.MinLon = min(b.MinLon, p.Lon)
			b.MinLat = min(b.MinLat, p.Lat)
			b.MaxLon = max(b.MaxLon, p.Lon)
			b.MaxLat = max(b.MaxLat, p.Lat)
		}
	}
	return b
}
