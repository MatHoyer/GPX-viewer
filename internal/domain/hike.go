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
	// Participants are the friends the owner tagged. Only loaded by single-hike reads.
	Participants []User
}

// HikeUpdate is a partial update of a hike; nil fields are left unchanged.
type HikeUpdate struct {
	Name   *string
	Notes  *string
	Labels *[]string
}

// HikeTrack is a lightweight, possibly simplified geometry for map display.
type HikeTrack struct {
	ID       uuid.UUID
	Name     string
	Segments []Segment
}

type HikeRepository interface {
	Create(ctx context.Context, h *Hike) error
	// ListByUser returns the hikes a user owns or is tagged on, without
	// geometry or raw GPX, newest first.
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Hike, error)
	GetByID(ctx context.Context, userID, id uuid.UUID) (*Hike, error)
	// Find returns a hike whoever owns it, without geometry or raw GPX.
	Find(ctx context.Context, id uuid.UUID) (*Hike, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	Update(ctx context.Context, userID, id uuid.UUID, u HikeUpdate) error
	// ListLabels returns the labels on a user's own hikes, most used first.
	ListLabels(ctx context.Context, userID uuid.UUID) ([]string, error)
	GetRawGPX(ctx context.Context, userID, id uuid.UUID) ([]byte, error)
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
}
