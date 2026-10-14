package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// WeatherHour is the weather during the hour starting at Time, at the place
// the hiker was then.
type WeatherHour struct {
	Time       time.Time `json:"time"`
	Lat        float64   `json:"lat"`
	Lon        float64   `json:"lon"`
	TempC      float64   `json:"tempC"`
	FeelsLikeC float64   `json:"feelsLikeC"`
	PrecipMM   float64   `json:"precipMM"`
	SnowCM     float64   `json:"snowCM"`
	WindKmh    float64   `json:"windKmh"`
	GustKmh    float64   `json:"gustKmh"`
	CloudPct   int       `json:"cloudPct"`
	// Code is a WMO weather interpretation code (0 clear ... 99 thunderstorm).
	Code int `json:"code"`
}

// WeatherSummary sums up a hike's hourly weather.
type WeatherSummary struct {
	MinTempC   float64
	MaxTempC   float64
	PrecipMM   float64
	SnowCM     float64
	MaxWindKmh float64
	MaxGustKmh float64
	// Code is the highest WMO code seen; higher codes are roughly the worse
	// conditions, so a single rainy hour shows as rain.
	Code int
}

// SummarizeWeather returns nil when there is no weather.
func SummarizeWeather(hours []WeatherHour) *WeatherSummary {
	if len(hours) == 0 {
		return nil
	}
	s := WeatherSummary{MinTempC: hours[0].TempC, MaxTempC: hours[0].TempC}
	for _, h := range hours {
		s.MinTempC = min(s.MinTempC, h.TempC)
		s.MaxTempC = max(s.MaxTempC, h.TempC)
		s.PrecipMM += h.PrecipMM
		s.SnowCM += h.SnowCM
		s.MaxWindKmh = max(s.MaxWindKmh, h.WindKmh)
		s.MaxGustKmh = max(s.MaxGustKmh, h.GustKmh)
		s.Code = max(s.Code, h.Code)
	}
	return &s
}

// WeatherQuery asks for the weather of the hour starting at Time, at a place.
// Ele is nil when the track has no elevation.
type WeatherQuery struct {
	Time     time.Time
	Lat, Lon float64
	Ele      *float64
}

// WeatherProvider fetches past weather.
type WeatherProvider interface {
	// Hourly returns the weather for each query, in order, in one request.
	Hourly(ctx context.Context, qs []WeatherQuery) ([]WeatherHour, error)
}

type WeatherRepository interface {
	// ListMissing returns up to limit done, timed hikes that ended before
	// endedBefore and have no weather yet, with only their ID and raw GPX loaded.
	ListMissing(ctx context.Context, endedBefore time.Time, limit int) ([]Hike, error)
	// Save stores a hike's weather; empty hours mark a hike that has none.
	Save(ctx context.Context, hikeID uuid.UUID, hours []WeatherHour) error
}
