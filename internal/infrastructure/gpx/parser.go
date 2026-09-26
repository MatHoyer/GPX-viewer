package gpx

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/tkrajina/gpxgo/gpx"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Parser struct{}

func NewParser() *Parser { return &Parser{} }

// Parse reads GPX tracks and routes. Routes are treated as extra track segments.
func (p *Parser) Parse(data []byte) (*domain.ParsedTrack, error) {
	g, err := gpx.ParseBytes(data)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", domain.ErrInvalidGPX, err)
	}

	for _, r := range g.Routes {
		if len(r.Points) > 0 {
			g.Tracks = append(g.Tracks, gpx.GPXTrack{
				Name:     r.Name,
				Segments: []gpx.GPXTrackSegment{{Points: r.Points}},
			})
		}
	}

	var segments []domain.Segment
	var start, end time.Time
	for _, t := range g.Tracks {
		for _, s := range t.Segments {
			// A line needs at least two points.
			if len(s.Points) < 2 {
				continue
			}
			seg := make(domain.Segment, 0, len(s.Points))
			for _, pt := range s.Points {
				ele := 0.0
				if pt.Elevation.NotNull() {
					ele = pt.Elevation.Value()
				}
				seg = append(seg, domain.Point{Lon: pt.Longitude, Lat: pt.Latitude, Ele: ele})
				if ts := pt.Timestamp; !ts.IsZero() {
					if start.IsZero() || ts.Before(start) {
						start = ts
					}
					if ts.After(end) {
						end = ts
					}
				}
			}
			segments = append(segments, seg)
		}
	}
	if len(segments) == 0 {
		return nil, fmt.Errorf("%w: no track points", domain.ErrInvalidGPX)
	}

	res := &domain.ParsedTrack{
		Name:           trackName(g),
		Segments:       segments,
		DistanceM:      round1(g.Length2D()),
		ElevationGainM: round1(g.UphillDownhill().Uphill),
	}
	// gpxgo's HasTimes/TimeBounds are unreliable, so time bounds are computed above.
	if !start.IsZero() {
		startUTC := start.UTC()
		res.StartedAt = &startUTC
		res.DurationS = int64(end.Sub(start).Seconds())
	}
	return res, nil
}

func trackName(g *gpx.GPX) string {
	if n := strings.TrimSpace(g.Name); n != "" {
		return n
	}
	for _, t := range g.Tracks {
		if n := strings.TrimSpace(t.Name); n != "" {
			return n
		}
	}
	return ""
}

func round1(v float64) float64 {
	if math.IsNaN(v) || math.IsInf(v, 0) {
		return 0
	}
	return math.Round(v*10) / 10
}
