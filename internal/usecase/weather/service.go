// Package weather fetches the weather hikes had, in the background.
package weather

import (
	"context"
	"log/slog"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Lag is how long after a hike ends its weather is fetched, so the archive
// has the whole hike.
// shortcut: recent days are forecast data the archive later swaps for
// reanalysis; refetch after ~5 days if accuracy ever matters.
const Lag = 24 * time.Hour

// maxQueries caps the places asked per hike, keeping the request URL short;
// longer hikes are sampled every few hours.
const maxQueries = 100

// BatchSize is how many hikes Fetch handles per run.
const BatchSize = 10

type Service struct {
	repo     domain.WeatherRepository
	parser   domain.TrackParser
	provider domain.WeatherProvider
	now      func() time.Time
	// pause spaces out requests to the provider.
	pause time.Duration
}

func NewService(repo domain.WeatherRepository, parser domain.TrackParser, provider domain.WeatherProvider) *Service {
	return &Service{repo: repo, parser: parser, provider: provider, now: time.Now, pause: time.Second}
}

// Fetch stores the weather of up to one batch of hikes that lack it and
// returns how many were done. It stops at the first provider error so a
// rate limit or outage is retried on the next run.
func (s *Service) Fetch(ctx context.Context) (int, error) {
	batch, err := s.repo.ListMissing(ctx, s.now().Add(-Lag), BatchSize)
	if err != nil {
		return 0, err
	}
	n := 0
	for i, h := range batch {
		var hours []domain.WeatherHour
		samples, err := s.parser.Samples(h.RawGPX)
		if err != nil {
			slog.Warn("weather: parse hike", "hike", h.ID, "err", err)
		} else if qs := queries(samples); len(qs) > 0 {
			if i > 0 {
				select {
				case <-ctx.Done():
					return n, ctx.Err()
				case <-time.After(s.pause):
				}
			}
			if hours, err = s.provider.Hourly(ctx, qs); err != nil {
				return n, err
			}
		}
		// Hikes with no usable timestamps are saved empty so they are not retried.
		if err := s.repo.Save(ctx, h.ID, hours); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}

// queries picks, for each hour the hike spans, where the hiker was half way
// through it (clamped to the hike), so a valley start and a ridge later each
// get their own weather.
func queries(samples []domain.Sample) []domain.WeatherQuery {
	var timed []domain.Sample
	for _, s := range samples {
		if s.Time != nil && (len(timed) == 0 || !s.Time.Before(*timed[len(timed)-1].Time)) {
			timed = append(timed, s)
		}
	}
	if len(timed) == 0 {
		return nil
	}
	start, end := *timed[0].Time, *timed[len(timed)-1].Time
	first := start.Truncate(time.Hour)
	hours := int(end.Sub(first)/time.Hour) + 1
	step := (hours + maxQueries - 1) / maxQueries
	var out []domain.WeatherQuery
	j := 0
	for k := 0; k < hours; k += step {
		h := first.Add(time.Duration(k) * time.Hour)
		at := h.Add(30 * time.Minute)
		for j+1 < len(timed) && !timed[j+1].Time.After(at) {
			j++
		}
		p := timed[j]
		out = append(out, domain.WeatherQuery{Time: h, Lat: p.Lat, Lon: p.Lon, Ele: p.Ele})
	}
	return out
}
