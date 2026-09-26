package gpx

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func parseFixture(t *testing.T, name string) (*domain.ParsedTrack, error) {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		t.Fatal(err)
	}
	return NewParser().Parse(data)
}

func TestParseTrack(t *testing.T) {
	got, err := parseFixture(t, "track.gpx")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Col de la Croix" {
		t.Errorf("name = %q", got.Name)
	}
	if len(got.Segments) != 2 || len(got.Segments[0]) != 3 || len(got.Segments[1]) != 3 {
		t.Fatalf("unexpected segments: %+v", got.Segments)
	}
	if p := got.Segments[0][0]; p.Lon != 6.8 || p.Lat != 45.9 || p.Ele != 1000 {
		t.Errorf("first point = %+v", p)
	}
	if got.DistanceM < 1500 || got.DistanceM > 2500 {
		t.Errorf("distance = %v", got.DistanceM)
	}
	if got.ElevationGainM <= 0 {
		t.Errorf("elevation gain = %v", got.ElevationGainM)
	}
	if got.ElevationLossM <= 0 || got.ElevationLossM >= got.ElevationGainM {
		t.Errorf("elevation loss = %v", got.ElevationLossM)
	}
	wantStart := time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)
	if got.StartedAt == nil || !got.StartedAt.Equal(wantStart) {
		t.Errorf("startedAt = %v", got.StartedAt)
	}
	if got.DurationS != 2*3600 {
		t.Errorf("duration = %d", got.DurationS)
	}
}

func TestParseWithoutTimeOrElevation(t *testing.T) {
	got, err := parseFixture(t, "no_time_no_ele.gpx")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "" || got.StartedAt != nil || got.DurationS != 0 || got.ElevationGainM != 0 {
		t.Errorf("unexpected result: %+v", got)
	}
	if got.Segments[0][0].Ele != 0 {
		t.Errorf("ele = %v", got.Segments[0][0].Ele)
	}
}

func TestParseRoute(t *testing.T) {
	got, err := parseFixture(t, "route.gpx")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Planned route" || len(got.Segments) != 1 || len(got.Segments[0]) != 2 {
		t.Errorf("unexpected result: %+v", got)
	}
}

func TestParseInvalid(t *testing.T) {
	for _, name := range []string{"invalid.gpx", "waypoints_only.gpx"} {
		t.Run(name, func(t *testing.T) {
			if _, err := parseFixture(t, name); !errors.Is(err, domain.ErrInvalidGPX) {
				t.Errorf("err = %v, want ErrInvalidGPX", err)
			}
		})
	}
}

func TestSamplesWithExtensions(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "garmin_ext.gpx"))
	if err != nil {
		t.Fatal(err)
	}
	got, err := NewParser().Samples(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 4 {
		t.Fatalf("len = %d", len(got))
	}
	first := got[0]
	if first.HR == nil || *first.HR != 110 || first.Cad == nil || *first.Cad != 80 || first.Temp == nil || *first.Temp != 18.5 {
		t.Errorf("first sample sensors = hr %v cad %v temp %v", first.HR, first.Cad, first.Temp)
	}
	if first.Ele == nil || *first.Ele != 1000 || first.Time == nil {
		t.Errorf("first sample ele/time missing")
	}
	if got[1].Cad != nil || got[2].HR != nil {
		t.Errorf("missing values should stay nil")
	}
	if got[1].Segment != 0 || got[2].Segment != 1 {
		t.Errorf("segments = %d, %d", got[1].Segment, got[2].Segment)
	}
}

func TestSamplesWithoutSensors(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "no_time_no_ele.gpx"))
	if err != nil {
		t.Fatal(err)
	}
	got, err := NewParser().Samples(data)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range got {
		if s.Ele != nil || s.Time != nil || s.HR != nil {
			t.Errorf("unexpected optional data: %+v", s)
		}
	}
}

func TestRouteDropsTimesAndSensors(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "garmin_ext.gpx"))
	if err != nil {
		t.Fatal(err)
	}
	p := NewParser()
	route, err := p.Route(data)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := p.Parse(route)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.StartedAt != nil || parsed.DurationS != 0 {
		t.Errorf("times kept: %+v", parsed)
	}
	samples, err := p.Samples(route)
	if err != nil {
		t.Fatal(err)
	}
	orig, _ := p.Samples(data)
	if len(samples) != len(orig) || len(samples) == 0 {
		t.Fatalf("samples = %d, want %d", len(samples), len(orig))
	}
	for _, s := range samples {
		if s.Time != nil || s.HR != nil || s.Cad != nil || s.Temp != nil {
			t.Errorf("activity data kept: %+v", s)
		}
	}
	if (orig[0].Ele == nil) != (samples[0].Ele == nil) || samples[0].Lat != orig[0].Lat {
		t.Errorf("geometry changed: %+v vs %+v", samples[0], orig[0])
	}
}

func TestRouteInvalid(t *testing.T) {
	if _, err := NewParser().Route([]byte("nope")); !errors.Is(err, domain.ErrInvalidGPX) {
		t.Errorf("err = %v", err)
	}
}
