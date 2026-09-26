package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Peak is a named summit from OpenStreetMap (natural=peak).
type Peak struct {
	// ID is the OpenStreetMap node id.
	ID       int64
	Name     string
	EleM     *float64
	Lon, Lat float64
}

// SummitVisit is a hike that went over a peak.
type SummitVisit struct {
	HikeID    uuid.UUID
	StartedAt *time.Time
}

// Summit is a peak a user reached, with every hike that went over it, newest first.
type Summit struct {
	Peak   Peak
	Visits []SummitVisit
}

type PeakRepository interface {
	// Upsert inserts peaks or updates them by ID.
	Upsert(ctx context.Context, peaks []Peak) error
	// OnHike returns the peaks within radiusM meters of a hike's track, highest first.
	OnHike(ctx context.Context, hikeID uuid.UUID, radiusM float64) ([]Peak, error)
	// OfUser returns the peaks within radiusM meters of the hikes a user owns
	// or is tagged on, leaving out planned hikes.
	OfUser(ctx context.Context, userID uuid.UUID, radiusM float64) ([]Summit, error)
}

// PeakSource fetches named peaks inside [minLon, minLat, maxLon, maxLat].
type PeakSource interface {
	Peaks(ctx context.Context, bbox Bounds) ([]Peak, error)
}
