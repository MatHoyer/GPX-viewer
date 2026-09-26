package hike

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

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

// MaxNameLength bounds hike names, in characters.
const MaxNameLength = 200

// Rename changes a hike's name and returns the updated hike.
func (s *Service) Rename(ctx context.Context, userID, id uuid.UUID, name string) (*domain.Hike, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, &domain.ValidationError{Field: "name", Message: "must not be empty"}
	}
	if utf8.RuneCountInString(name) > MaxNameLength {
		return nil, &domain.ValidationError{Field: "name", Message: fmt.Sprintf("must be at most %d characters", MaxNameLength)}
	}
	if err := s.hikes.Rename(ctx, userID, id, name); err != nil {
		return nil, err
	}
	return s.hikes.GetByID(ctx, userID, id)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.hikes.Delete(ctx, userID, id)
}

// Profile builds the detailed time/distance series of a hike from its original GPX.
func (s *Service) Profile(ctx context.Context, userID, id uuid.UUID) (*domain.Profile, error) {
	raw, err := s.hikes.GetRawGPX(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	samples, err := s.parser.Samples(raw)
	if err != nil {
		return nil, err
	}
	return BuildProfile(samples, ProfileMaxPoints), nil
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
