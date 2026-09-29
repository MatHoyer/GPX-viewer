package hike

import (
	"context"
	"fmt"
	"path/filepath"
	"slices"
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
	return s.importHike(ctx, userID, filename, data, false)
}

// ImportPlanned stores a GPX route as a hike userID plans to do. Only the
// route is kept: times and sensor data of whoever recorded it are dropped.
func (s *Service) ImportPlanned(ctx context.Context, userID uuid.UUID, filename string, data []byte) (*domain.Hike, error) {
	return s.importHike(ctx, userID, filename, data, true)
}

func (s *Service) importHike(ctx context.Context, userID uuid.UUID, filename string, data []byte, planned bool) (*domain.Hike, error) {
	if planned {
		route, err := s.parser.Route(data)
		if err != nil {
			return nil, err
		}
		data = route
	}
	h, parsedName, err := s.buildTrack(data)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(parsedName)
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	}
	if name == "" {
		name = "Untitled hike"
	}

	h.ID = uuid.New()
	h.UserID = userID
	h.Name = name
	h.Planned = planned
	h.CreatedAt = s.now().UTC()
	if err := s.hikes.Create(ctx, h); err != nil {
		return nil, err
	}
	return h, nil
}

// buildTrack parses a GPX file into a hike's track, stats and derived data,
// and returns the name the file gives it.
func (s *Service) buildTrack(data []byte) (*domain.Hike, string, error) {
	parsed, err := s.parser.Parse(data)
	if err != nil {
		return nil, "", err
	}
	if countPoints(parsed.Segments) < 2 {
		return nil, "", domain.ErrInvalidGPX
	}
	samples, err := s.parser.Samples(data)
	if err != nil {
		return nil, "", err
	}
	return &domain.Hike{
		DistanceM:      parsed.DistanceM,
		ElevationGainM: parsed.ElevationGainM,
		StartedAt:      parsed.StartedAt,
		DurationS:      parsed.DurationS,
		HikeDerived:    derive(parsed, samples),
		DerivedVersion: DerivedVersion,
		Segments:       parsed.Segments,
		Bounds:         computeBounds(parsed.Segments),
		RawGPX:         data,
	}, parsed.Name, nil
}

// MarkDone marks one of userID's planned hikes as walked. With a GPX file, the
// recorded track replaces the planned route, bringing its times and sensor
// data; without one, the route is kept as walked.
func (s *Service) MarkDone(ctx context.Context, userID, id uuid.UUID, data []byte) (*domain.Hike, error) {
	h, err := s.hikes.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if !h.Planned {
		return nil, &domain.ValidationError{Field: "planned", Message: "hike is already done", Code: "already_done"}
	}
	if data == nil {
		done := false
		if err := s.hikes.Update(ctx, userID, id, domain.HikeUpdate{Planned: &done}); err != nil {
			return nil, err
		}
	} else {
		track, _, err := s.buildTrack(data)
		if err != nil {
			return nil, err
		}
		if err := s.hikes.ReplaceTrack(ctx, userID, id, track); err != nil {
			return nil, err
		}
	}
	return s.hikes.GetByID(ctx, userID, id)
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
		return &domain.ValidationError{Field: "user", Message: "you are already on your own hike", Code: "own_hike"}
	}
	ok, err := s.access.AreFriends(ctx, owner, friend)
	if err != nil {
		return err
	}
	if !ok {
		return &domain.ValidationError{Field: "user", Message: "you can only tag your friends", Code: "not_friend"}
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

const (
	// MaxNameLength bounds hike names, in characters.
	MaxNameLength = 200
	// MaxNotesLength bounds hike notes, in characters.
	MaxNotesLength = 10000
	// MaxLabelLength bounds each label, in characters.
	MaxLabelLength = 32
	// MaxLabels bounds the number of labels on a hike.
	MaxLabels = 20
)

// Update changes a hike's name, notes and labels, and returns the updated hike.
func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, u domain.HikeUpdate) (*domain.Hike, error) {
	if u.Name != nil {
		name := strings.TrimSpace(*u.Name)
		if name == "" {
			return nil, &domain.ValidationError{Field: "name", Message: "must not be empty", Code: "required"}
		}
		if utf8.RuneCountInString(name) > MaxNameLength {
			return nil, &domain.ValidationError{Field: "name", Message: fmt.Sprintf("must be at most %d characters", MaxNameLength), Code: "too_long", Params: map[string]any{"max": MaxNameLength}}
		}
		u.Name = &name
	}
	if u.Notes != nil {
		notes := strings.TrimSpace(*u.Notes)
		if utf8.RuneCountInString(notes) > MaxNotesLength {
			return nil, &domain.ValidationError{Field: "notes", Message: fmt.Sprintf("must be at most %d characters", MaxNotesLength), Code: "too_long", Params: map[string]any{"max": MaxNotesLength}}
		}
		u.Notes = &notes
	}
	if u.Labels != nil {
		labels, err := normalizeLabels(*u.Labels)
		if err != nil {
			return nil, err
		}
		u.Labels = &labels
	}
	if err := s.hikes.Update(ctx, userID, id, u); err != nil {
		return nil, err
	}
	return s.hikes.GetByID(ctx, userID, id)
}

// normalizeLabels lowercases, trims and collapses inner spaces, then drops
// duplicates and sorts, so "Snow " and "snow" are the same label.
func normalizeLabels(in []string) ([]string, error) {
	seen := map[string]bool{}
	out := []string{}
	for _, l := range in {
		l = strings.Join(strings.Fields(strings.ToLower(l)), " ")
		if l == "" || seen[l] {
			continue
		}
		if utf8.RuneCountInString(l) > MaxLabelLength {
			return nil, &domain.ValidationError{Field: "labels", Message: fmt.Sprintf("each label must be at most %d characters", MaxLabelLength), Code: "label_too_long", Params: map[string]any{"max": MaxLabelLength}}
		}
		seen[l] = true
		out = append(out, l)
	}
	if len(out) > MaxLabels {
		return nil, &domain.ValidationError{Field: "labels", Message: fmt.Sprintf("at most %d labels per hike", MaxLabels), Code: "too_many_labels", Params: map[string]any{"max": MaxLabels}}
	}
	slices.Sort(out)
	return out, nil
}

// Labels returns the labels a user has put on their hikes, most used first.
func (s *Service) Labels(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.hikes.ListLabels(ctx, userID)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.hikes.Delete(ctx, userID, id)
}

// MaxBulk bounds how many hikes one bulk action names.
const MaxBulk = 1000

// DeleteMany deletes those of ids the user owns, skipping the rest, and
// returns how many went.
func (s *Service) DeleteMany(ctx context.Context, userID uuid.UUID, ids []uuid.UUID) (int64, error) {
	if err := validateBulk(ids); err != nil {
		return 0, err
	}
	return s.hikes.DeleteMany(ctx, userID, ids)
}

func validateBulk(ids []uuid.UUID) error {
	if len(ids) == 0 {
		return &domain.ValidationError{Field: "ids", Message: "select at least one hike", Code: "no_hikes_selected"}
	}
	if len(ids) > MaxBulk {
		return &domain.ValidationError{Field: "ids", Message: fmt.Sprintf("select at most %d hikes", MaxBulk), Code: "too_many_hikes", Params: map[string]any{"max": MaxBulk}}
	}
	return nil
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

// Export calls fn with each hike userID owns and its original GPX, newest
// first, limited to ids unless nil. Hikes they are only tagged on belong to
// their owner and are skipped.
func (s *Service) Export(ctx context.Context, userID uuid.UUID, ids []uuid.UUID, fn func(h *domain.Hike, raw []byte) error) error {
	var only map[uuid.UUID]bool
	if ids != nil {
		if err := validateBulk(ids); err != nil {
			return err
		}
		only = make(map[uuid.UUID]bool, len(ids))
		for _, id := range ids {
			only[id] = true
		}
	}
	hikes, err := s.hikes.ListByUser(ctx, userID)
	if err != nil {
		return err
	}
	for i := range hikes {
		h := &hikes[i]
		if h.UserID != userID || (only != nil && !only[h.ID]) {
			continue
		}
		raw, err := s.hikes.GetRawGPX(ctx, userID, h.ID)
		if err != nil {
			return err
		}
		if err := fn(h, raw); err != nil {
			return err
		}
	}
	return nil
}

// Card returns a hike and its simplified track for a preview image, if viewer may see it.
func (s *Service) Card(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, []domain.Segment, error) {
	h, err := s.Get(ctx, viewer, id)
	if err != nil {
		return nil, nil, err
	}
	segs, err := s.hikes.GetTrack(ctx, id, TrackTolerance)
	if err != nil {
		return nil, nil, err
	}
	return h, segs, nil
}

// FeedPageSize is how many hikes a page of the activity feed holds.
const FeedPageSize = 20

// Feed returns a page of friends' recent hikes and those userID was tagged on,
// after the cursor when set, with the cursor of the next page (nil at the end).
func (s *Service) Feed(ctx context.Context, userID uuid.UUID, after *domain.FeedCursor) ([]domain.Hike, *domain.FeedCursor, error) {
	hikes, err := s.hikes.ListFeed(ctx, userID, after, FeedPageSize)
	if err != nil || len(hikes) < FeedPageSize {
		return hikes, nil, err
	}
	last := hikes[len(hikes)-1]
	at := last.CreatedAt
	if last.StartedAt != nil {
		at = *last.StartedAt
	}
	return hikes, &domain.FeedCursor{At: at, ID: last.ID}, nil
}

// SameRouteDeviationM is how far apart two tracks may stray and still be the same route.
const SameRouteDeviationM = 200

// Similar returns viewer's other hikes along the same route as hike id, which
// viewer must be able to see.
func (s *Service) Similar(ctx context.Context, viewer, id uuid.UUID) ([]domain.Hike, error) {
	if _, err := s.Get(ctx, viewer, id); err != nil {
		return nil, err
	}
	return s.hikes.ListSimilar(ctx, viewer, id, SameRouteDeviationM)
}

// Tiles returns the explored tiles of each hike owner owns or is tagged on,
// if viewer may see owner's hikes.
func (s *Service) Tiles(ctx context.Context, viewer, owner uuid.UUID) (map[uuid.UUID][]domain.Tile, error) {
	if err := s.authorize(ctx, viewer, owner); err != nil {
		return nil, err
	}
	return s.hikes.ListTiles(ctx, owner)
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
