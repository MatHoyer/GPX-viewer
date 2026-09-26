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
	if len(got.Segments) != 2 || len(got.Segments[0]) != 3 || len(got.Segments[1]) != 2 {
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
