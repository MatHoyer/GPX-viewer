package domain

import "time"

// ParsedTrack is the result of parsing a GPS track file.
type ParsedTrack struct {
	Name           string
	Segments       []Segment
	DistanceM      float64
	ElevationGainM float64
	StartedAt      *time.Time
	DurationS      int64
}

type TrackParser interface {
	Parse(data []byte) (*ParsedTrack, error)
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Compare(hash, password string) error
}
