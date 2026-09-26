package gpx

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/tkrajina/gpxgo/gpx"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Parser struct{}

func NewParser() *Parser { return &Parser{} }

// load parses GPX data and returns it with its usable segments.
// Routes are treated as extra track segments; segments with fewer than
// two points are dropped since they cannot form a line.
func load(data []byte) (*gpx.GPX, [][]gpx.GPXPoint, error) {
	g, err := gpx.ParseBytes(data)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: %v", domain.ErrInvalidGPX, err)
	}

	for _, r := range g.Routes {
		if len(r.Points) > 0 {
			g.Tracks = append(g.Tracks, gpx.GPXTrack{
				Name:     r.Name,
				Segments: []gpx.GPXTrackSegment{{Points: r.Points}},
			})
		}
	}

	var segments [][]gpx.GPXPoint
	for _, t := range g.Tracks {
		for _, s := range t.Segments {
			if len(s.Points) >= 2 {
				segments = append(segments, s.Points)
			}
		}
	}
	if len(segments) == 0 {
		return nil, nil, fmt.Errorf("%w: no track points", domain.ErrInvalidGPX)
	}
	return g, segments, nil
}

func (p *Parser) Parse(data []byte) (*domain.ParsedTrack, error) {
	g, rawSegments, err := load(data)
	if err != nil {
		return nil, err
	}

	segments := make([]domain.Segment, 0, len(rawSegments))
	var start, end time.Time
	for _, pts := range rawSegments {
		seg := make(domain.Segment, 0, len(pts))
		for _, pt := range pts {
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

func (p *Parser) Samples(data []byte) ([]domain.Sample, error) {
	_, segments, err := load(data)
	if err != nil {
		return nil, err
	}

	var out []domain.Sample
	for segIdx, pts := range segments {
		for _, pt := range pts {
			s := domain.Sample{Lon: pt.Longitude, Lat: pt.Latitude, Segment: segIdx}
			if pt.Elevation.NotNull() {
				v := pt.Elevation.Value()
				s.Ele = &v
			}
			if !pt.Timestamp.IsZero() {
				ts := pt.Timestamp.UTC()
				s.Time = &ts
			}
			readExtensions(pt.Extensions.Nodes, &s)
			out = append(out, s)
		}
	}
	return out, nil
}

// readExtensions extracts sensor values from vendor extensions such as
// Garmin TrackPointExtension (<gpxtpx:hr>, <gpxtpx:cad>, <gpxtpx:atemp>),
// matching on local element names so any namespace prefix works.
func readExtensions(nodes []gpx.ExtensionNode, s *domain.Sample) {
	for _, n := range nodes {
		if len(n.Nodes) > 0 {
			readExtensions(n.Nodes, s)
			continue
		}
		v, err := strconv.ParseFloat(strings.TrimSpace(n.Data), 64)
		if err != nil || math.IsNaN(v) || math.IsInf(v, 0) {
			continue
		}
		switch strings.ToLower(n.XMLName.Local) {
		case "hr", "heartrate":
			if s.HR == nil && v > 0 {
				s.HR = &v
			}
		case "cad", "cadence":
			if s.Cad == nil {
				s.Cad = &v
			}
		case "atemp", "temp", "temperature":
			if s.Temp == nil {
				s.Temp = &v
			}
		}
	}
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
