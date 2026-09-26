package ogimage

import (
	"bytes"
	"image/png"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestRender(t *testing.T) {
	started := time.Date(2026, 9, 20, 7, 0, 0, 0, time.UTC)
	h := &domain.Hike{
		Name: "Brévent traverse " + strings.Repeat("with a very long name ", 5), DistanceM: 5510, ElevationGainM: 1191.6,
		DurationS: 15000, StartedAt: &started, Owner: &domain.User{Name: "Ana"},
	}
	segs := []domain.Segment{{{Lon: 6.80, Lat: 45.90}, {Lon: 6.8175, Lat: 45.9196}, {Lon: 6.8378, Lat: 45.9339}}}
	b, err := Render(h, segs)
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	if s := img.Bounds().Size(); s.X != Width || s.Y != Height {
		t.Errorf("size = %v", s)
	}
	// A track pixel: the middle of the drawn line is the track color.
	if dir := os.Getenv("OG_OUT"); dir != "" {
		_ = os.WriteFile(dir+"/og-test.png", b, 0o644)
	}
	if _, err := Render(&domain.Hike{Name: "Empty"}, nil); err != nil {
		t.Errorf("render without track: %v", err)
	}
}
