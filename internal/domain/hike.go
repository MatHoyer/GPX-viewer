package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Point is a WGS84 position. Ele is 0 when the source has no elevation.
type Point struct {
	Lon float64
	Lat float64
	Ele float64
}

type Segment []Point

type Bounds struct {
	MinLon, MinLat, MaxLon, MaxLat float64
}

// HikeDerived holds statistics computed from the original GPX. Pointers are
// nil when the track lacks the data (no elevation or no timestamps).
type HikeDerived struct {
	ElevationLossM float64
	MinEleM        *float64
	MaxEleM        *float64
	MovingS        *int64
	// BestEfforts are the fastest times over standard distances the hike
	// covers, shortest distance first. Empty without timestamps.
	BestEfforts []BestEffort
	// Tiles are the zoom-14 map tiles the track passes through.
	Tiles []Tile
}

// TileZoom is the zoom level of explored tiles (about 2.4 km at the equator).
const TileZoom = 14

// Tile is a slippy map tile at TileZoom.
type Tile struct {
	X, Y int
}

// BestEffort is the shortest time a hike took to cover DistanceM.
type BestEffort struct {
	DistanceM int
	DurationS int
}

type Hike struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	Name           string
	DistanceM      float64
	ElevationGainM float64
	StartedAt      *time.Time
	DurationS      int64
	Notes          string
	// Planned hikes are routes not walked yet: they show on the map but
	// count toward no stats, records, tiles, summits or repeated routes.
	Planned bool
	// Labels are the owner's free-form labels, lowercase and sorted.
	Labels []string
	HikeDerived
	// DerivedVersion is the version of the code that computed HikeDerived;
	// hikes below the current version are recomputed in the background.
	DerivedVersion int
	Segments       []Segment
	Bounds         Bounds
	RawGPX         []byte
	CreatedAt      time.Time
	// Owner is loaded by list and single-hike reads.
	Owner *User
	// Participants are the friends the owner tagged. Loaded by list and single-hike reads.
	Participants []User
}

// FeedCursor marks where a page of the activity feed ended: its last hike's
// sort time (start, else upload) and id.
type FeedCursor struct {
	At time.Time
	ID uuid.UUID
}

// HikeUpdate is a partial update of a hike; nil fields are left unchanged.
type HikeUpdate struct {
	Name    *string
	Notes   *string
	Labels  *[]string
	Planned *bool
}

// HikeTrack is a lightweight, possibly simplified geometry for map display.
type HikeTrack struct {
	ID       uuid.UUID
	Name     string
	Segments []Segment
}

type HikeRepository interface {
	Create(ctx context.Context, h *Hike) error
	// ListByUser returns the hikes a user owns or is tagged on, with their
	// participants but without geometry or raw GPX, newest first.
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Hike, error)
	GetByID(ctx context.Context, userID, id uuid.UUID) (*Hike, error)
	// Find returns a hike whoever owns it, without geometry or raw GPX.
	Find(ctx context.Context, id uuid.UUID) (*Hike, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	Update(ctx context.Context, userID, id uuid.UUID, u HikeUpdate) error
	// ListLabels returns the labels on a user's own hikes, most used first.
	ListLabels(ctx context.Context, userID uuid.UUID) ([]string, error)
	GetRawGPX(ctx context.Context, userID, id uuid.UUID) ([]byte, error)
	// GetTrack returns one hike's geometry, simplified with the given tolerance (degrees).
	GetTrack(ctx context.Context, id uuid.UUID, tolerance float64) ([]Segment, error)
	// ListTracks returns geometries of the hikes a user owns or is tagged on,
	// simplified with the given tolerance (degrees).
	ListTracks(ctx context.Context, userID uuid.UUID, tolerance float64) ([]HikeTrack, error)
	ListParticipants(ctx context.Context, hikeID uuid.UUID) ([]User, error)
	// AddParticipant is a no-op when the user is already tagged.
	AddParticipant(ctx context.Context, hikeID, userID uuid.UUID, at time.Time) error
	RemoveParticipant(ctx context.Context, hikeID, userID uuid.UUID) error
	// ListOutdated returns up to limit hikes whose derived data is below
	// version, with only their ID and raw GPX loaded.
	ListOutdated(ctx context.Context, version, limit int) ([]Hike, error)
	SaveDerived(ctx context.Context, id uuid.UUID, d HikeDerived, version int) error
	// ListSimilar returns the done hikes userID owns or is tagged on, other than
	// hikeID, whose track follows hikeID's within maxDeviationM meters (either
	// direction), without geometry or raw GPX, newest first.
	ListSimilar(ctx context.Context, userID, hikeID uuid.UUID, maxDeviationM float64) ([]Hike, error)
	// ListFeed returns up to limit done hikes, newest first and after `after`
	// when set, that friends whose visibility allows it own, or that userID
	// was tagged on by someone else. Loaded like ListByUser.
	ListFeed(ctx context.Context, userID uuid.UUID, after *FeedCursor, limit int) ([]Hike, error)
	// ListTiles returns the tiles of each done hike a user owns or is tagged on, by hike.
	ListTiles(ctx context.Context, userID uuid.UUID) (map[uuid.UUID][]Tile, error)
}
