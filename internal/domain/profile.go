package domain

import "time"

// Sample is a raw GPS fix read from a track file.
type Sample struct {
	Lon, Lat float64
	Ele      *float64
	Time     *time.Time
	HR       *float64
	Cad      *float64
	Temp     *float64
	// Segment is the index of the track segment the sample belongs to.
	Segment int
}

// ProfilePoint is a sample enriched with derived metrics.
type ProfilePoint struct {
	Sample
	DistM    float64
	ElapsedS *float64
	SpeedMS  *float64
}

type ProfileSummary struct {
	DistanceM      float64
	ElevationGainM float64
	ElevationLossM float64
	MinEle         *float64
	MaxEle         *float64
	ElapsedS       *float64
	MovingS        *float64
	AvgSpeedMS     *float64 // over moving time
	MaxSpeedMS     *float64
	AvgHR          *float64
	MaxHR          *float64
	AvgCad         *float64
	AvgTemp        *float64
}

type ProfileAvailability struct {
	Time, Ele, HR, Cad, Temp bool
}

// Profile is a (possibly downsampled) time/distance series of a hike.
type Profile struct {
	Points  []ProfilePoint
	Summary ProfileSummary
	Has     ProfileAvailability
}
