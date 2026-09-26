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

// Access decides whether viewer (uuid.Nil when anonymous) may see owner's hikes.
type Access interface {
	CanView(ctx context.Context, viewer, owner uuid.UUID) (bool, error)
	AreFriends(ctx context.Context, a, b uuid.UUID) (bool, error)
}

type Service struct {
	hikes  domain.HikeRepository
	parser domain.TrackParser
	access Access
	now    func() time.Time
}

func NewService(hikes domain.HikeRepository, parser domain.TrackParser, access Access) *Service {
	return &Service{hikes: hikes, parser: parser, access: access, now: time.Now}
}

// authorize hides hikes the viewer may not see as not found.
func (s *Service) authorize(ctx context.Context, viewer, owner uuid.UUID) error {
	ok, err := s.access.CanView(ctx, viewer, owner)
	if err != nil {
		return err
	}
	if !ok {
		return domain.ErrNotFound
	}
	return nil
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

// List returns the hikes owner owns or is tagged on, if viewer may see owner's hikes.
func (s *Service) List(ctx context.Context, viewer, owner uuid.UUID) ([]domain.Hike, error) {
	if err := s.authorize(ctx, viewer, owner); err != nil {
		return nil, err
	}
	return s.hikes.ListByUser(ctx, owner)
}

// Get returns a hike with its participants. Tagging a friend shares the hike
// with them, so it is visible to whoever can see its owner or a participant.
func (s *Service) Get(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, error) {
	h, err := s.hikes.Find(ctx, id)
	if err != nil {
		return nil, err
	}
	if h.Participants, err = s.hikes.ListParticipants(ctx, id); err != nil {
		return nil, err
	}
	for _, u := range append([]uuid.UUID{h.UserID}, participantIDs(h)...) {
		ok, err := s.access.CanView(ctx, viewer, u)
		if err != nil {
			return nil, err
		}
		if ok {
			return h, nil
		}
	}
	return nil, domain.ErrNotFound
}

func participantIDs(h *domain.Hike) []uuid.UUID {
	ids := make([]uuid.UUID, len(h.Participants))
	for i, u := range h.Participants {
		ids[i] = u.ID
	}
	return ids
}

// Tag adds one of the owner's friends to a hike, so it shows on their profile too.
func (s *Service) Tag(ctx context.Context, owner, id, friend uuid.UUID) error {
	if _, err := s.hikes.GetByID(ctx, owner, id); err != nil {
		return err
	}
	if friend == owner {
		return &domain.ValidationError{Field: "user", Message: "you are already on your own hike"}
	}
	ok, err := s.access.AreFriends(ctx, owner, friend)
	if err != nil {
		return err
	}
	if !ok {
		return &domain.ValidationError{Field: "user", Message: "you can only tag your friends"}
	}
	return s.hikes.AddParticipant(ctx, id, friend, s.now().UTC())
}

// Untag removes a participant. The owner can untag anyone; others only themselves.
func (s *Service) Untag(ctx context.Context, viewer, id, participant uuid.UUID) error {
	if participant != viewer {
		if _, err := s.hikes.GetByID(ctx, viewer, id); err != nil {
			return err
		}
	}
	return s.hikes.RemoveParticipant(ctx, id, participant)
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
func (s *Service) Profile(ctx context.Context, viewer, id uuid.UUID) (*domain.Profile, error) {
	h, err := s.Get(ctx, viewer, id)
	if err != nil {
		return nil, err
	}
	raw, err := s.hikes.GetRawGPX(ctx, h.UserID, id)
	if err != nil {
		return nil, err
	}
	samples, err := s.parser.Samples(raw)
	if err != nil {
		return nil, err
	}
	return BuildProfile(samples, ProfileMaxPoints), nil
}

// GPX returns a hike with its original GPX file, so anyone who can see the
// hike can download it and follow the same route.
func (s *Service) GPX(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, []byte, error) {
	h, err := s.Get(ctx, viewer, id)
	if err != nil {
		return nil, nil, err
	}
	raw, err := s.hikes.GetRawGPX(ctx, h.UserID, id)
	if err != nil {
		return nil, nil, err
	}
	return h, raw, nil
}

func (s *Service) Tracks(ctx context.Context, viewer, owner uuid.UUID) ([]domain.HikeTrack, error) {
	if err := s.authorize(ctx, viewer, owner); err != nil {
		return nil, err
	}
	return s.hikes.ListTracks(ctx, owner, TrackTolerance)
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
