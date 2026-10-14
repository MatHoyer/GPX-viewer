//go:build integration

package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestWeatherRepository(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(db); err != nil {
		t.Fatal(err)
	}
	u := &domain.User{ID: uuid.New(), Email: uuid.NewString() + "@test.local", PasswordHash: "x", CreatedAt: time.Now()}
	if err := NewUserRepository(db).Create(ctx, u); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&UserModel{}, "id = ?", u.ID) })

	hikes, weather := NewHikeRepository(db), NewWeatherRepository(db)
	// Far in the past so hikes of other tests never come first.
	start := time.Date(1950, 7, 1, 9, 0, 0, 0, time.UTC)
	newHike := func(startedAt *time.Time, planned bool) uuid.UUID {
		h := &domain.Hike{
			ID: uuid.New(), UserID: u.ID, Name: "w", StartedAt: startedAt, DurationS: 3600, Planned: planned,
			Segments:  []domain.Segment{{{Lon: 6.8, Lat: 45.9}, {Lon: 6.81, Lat: 45.91}}},
			RawGPX:    []byte("<gpx/>"),
			CreatedAt: time.Now(),
		}
		if err := hikes.Create(ctx, h); err != nil {
			t.Fatal(err)
		}
		return h.ID
	}
	timed := newHike(&start, false)
	newHike(nil, false)   // untimed
	newHike(&start, true) // planned

	missing := func(endedBefore time.Time) []uuid.UUID {
		list, err := weather.ListMissing(ctx, endedBefore, 1000)
		if err != nil {
			t.Fatal(err)
		}
		var ids []uuid.UUID
		for _, h := range list {
			if h.ID == timed || len(h.RawGPX) == 0 {
				ids = append(ids, h.ID)
			}
		}
		return ids
	}
	if got := missing(start.Add(30 * time.Minute)); len(got) != 0 {
		t.Errorf("hike still running is listed: %v", got)
	}
	if got := missing(start.Add(2 * time.Hour)); len(got) != 1 || got[0] != timed {
		t.Errorf("missing = %v, want only the timed hike", got)
	}

	hours := []domain.WeatherHour{{Time: start, Lat: 45.9, Lon: 6.8, TempC: 12.5, Code: 61}}
	if err := weather.Save(ctx, timed, hours); err != nil {
		t.Fatal(err)
	}
	if got := missing(start.Add(2 * time.Hour)); len(got) != 0 {
		t.Errorf("hike with weather still listed: %v", got)
	}
	got, err := hikes.Find(ctx, timed)
	if err != nil || len(got.Weather) != 1 || got.Weather[0] != hours[0] {
		t.Errorf("stored weather = %+v, %v", got, err)
	}
}
