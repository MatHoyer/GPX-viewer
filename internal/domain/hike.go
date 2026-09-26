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

type Hike struct {
	ID             uuid.UUID
	UserID         uuid.UUID
	Name           string
	DistanceM      float64
	ElevationGainM float64
	StartedAt      *time.Time
	DurationS      int64
	Segments       []Segment
	Bounds         Bounds
	RawGPX         []byte
	CreatedAt      time.Time
}

// HikeTrack is a lightweight, possibly simplified geometry for map display.
type HikeTrack struct {
	ID       uuid.UUID
	Name     string
	Segments []Segment
}

type HikeRepository interface {
	Create(ctx context.Context, h *Hike) error
	// ListByUser returns hikes without geometry or raw GPX, newest first.
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Hike, error)
	GetByID(ctx context.Context, userID, id uuid.UUID) (*Hike, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	GetRawGPX(ctx context.Context, userID, id uuid.UUID) ([]byte, error)
	// ListTracks returns geometries simplified with the given tolerance (degrees).
	ListTracks(ctx context.Context, userID uuid.UUID, tolerance float64) ([]HikeTrack, error)
}
