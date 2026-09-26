package dto

import (
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func NewUser(u *domain.User) User {
	return User{ID: u.ID.String(), Email: u.Email}
}

type Error struct {
	Error string `json:"error"`
	Field string `json:"field,omitempty"`
}

type Hike struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	DistanceM      float64    `json:"distanceM"`
	ElevationGainM float64    `json:"elevationGainM"`
	StartedAt      *time.Time `json:"startedAt"`
	DurationS      int64      `json:"durationS"`
	// Bounds is [minLon, minLat, maxLon, maxLat].
	Bounds    [4]float64 `json:"bounds"`
	CreatedAt time.Time  `json:"createdAt"`
}

func NewHike(h *domain.Hike) Hike {
	return Hike{
		ID:             h.ID.String(),
		Name:           h.Name,
		DistanceM:      h.DistanceM,
		ElevationGainM: h.ElevationGainM,
		StartedAt:      h.StartedAt,
		DurationS:      h.DurationS,
		Bounds:         [4]float64{h.Bounds.MinLon, h.Bounds.MinLat, h.Bounds.MaxLon, h.Bounds.MaxLat},
		CreatedAt:      h.CreatedAt,
	}
}

// UpdateHike is a partial update; nil fields are left unchanged.
type UpdateHike struct {
	Name *string `json:"name"`
}

type UploadResult struct {
	Filename string `json:"filename"`
	Hike     *Hike  `json:"hike,omitempty"`
	Error    string `json:"error,omitempty"`
}

// GeoJSON FeatureCollection of MultiLineStrings.
type FeatureCollection struct {
	Type     string    `json:"type"`
	Features []Feature `json:"features"`
}

type Feature struct {
	Type       string            `json:"type"`
	ID         string            `json:"id"`
	Geometry   MultiLineString   `json:"geometry"`
	Properties FeatureProperties `json:"properties"`
}

type MultiLineString struct {
	Type        string         `json:"type"`
	Coordinates [][][2]float64 `json:"coordinates"`
}

type FeatureProperties struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewFeatureCollection(tracks []domain.HikeTrack) FeatureCollection {
	fc := FeatureCollection{Type: "FeatureCollection", Features: make([]Feature, 0, len(tracks))}
	for _, t := range tracks {
		coords := make([][][2]float64, 0, len(t.Segments))
		for _, seg := range t.Segments {
			line := make([][2]float64, len(seg))
			for i, p := range seg {
				line[i] = [2]float64{p.Lon, p.Lat}
			}
			coords = append(coords, line)
		}
		id := t.ID.String()
		fc.Features = append(fc.Features, Feature{
			Type:       "Feature",
			ID:         id,
			Geometry:   MultiLineString{Type: "MultiLineString", Coordinates: coords},
			Properties: FeatureProperties{ID: id, Name: t.Name},
		})
	}
	return fc
}
