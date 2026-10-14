package weather

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func sample(lat float64, at time.Time) domain.Sample {
	return domain.Sample{Lat: lat, Time: &at}
}

func TestQueries(t *testing.T) {
	t0 := time.Date(2024, 7, 1, 9, 40, 0, 0, time.UTC)
	qs := queries([]domain.Sample{
		{Lat: 9}, // untimed points are skipped
		sample(1, t0),
		sample(2, t0.Add(40*time.Minute)),  // 10:20
		sample(3, t0.Add(80*time.Minute)),  // 11:00
		sample(4, t0.Add(30*time.Minute)),  // out of order, skipped
		sample(5, t0.Add(140*time.Minute)), // 12:00
	})
	// 09h: half past is before the start, so the start point.
	// 10h: last point by 10:30. 11h: by 11:30. 12h: the end.
	want := []struct {
		hour int
		lat  float64
	}{{9, 1}, {10, 2}, {11, 3}, {12, 5}}
	if len(qs) != len(want) {
		t.Fatalf("got %d queries: %+v", len(qs), qs)
	}
	for i, w := range want {
		if qs[i].Time.Hour() != w.hour || qs[i].Time.Minute() != 0 || qs[i].Lat != w.lat {
			t.Errorf("query %d = %v at %v, want %vh at %v", i, qs[i].Time, qs[i].Lat, w.hour, w.lat)
		}
	}
	if queries([]domain.Sample{{Lat: 1}}) != nil {
		t.Error("untimed track should have no queries")
	}
}

func TestQueriesCapsLongHikes(t *testing.T) {
	t0 := time.Date(2024, 7, 1, 0, 0, 0, 0, time.UTC)
	qs := queries([]domain.Sample{sample(1, t0), sample(2, t0.Add(10*24*time.Hour))})
	if len(qs) > maxQueries || qs[1].Time.Sub(qs[0].Time) != 3*time.Hour {
		t.Errorf("%d queries, step %v", len(qs), qs[1].Time.Sub(qs[0].Time))
	}
}

type fakeRepo struct {
	hikes []domain.Hike
	saved map[uuid.UUID][]domain.WeatherHour
}

func (r *fakeRepo) ListMissing(context.Context, time.Time, int) ([]domain.Hike, error) {
	return r.hikes, nil
}

func (r *fakeRepo) Save(_ context.Context, id uuid.UUID, hours []domain.WeatherHour) error {
	r.saved[id] = hours
	return nil
}

// fakeParser treats the raw GPX as a start time, or as untimed when empty.
type fakeParser struct{ domain.TrackParser }

func (fakeParser) Samples(raw []byte) ([]domain.Sample, error) {
	if string(raw) == "bad" {
		return nil, errors.New("bad gpx")
	}
	at, err := time.Parse(time.RFC3339, string(raw))
	if err != nil {
		return []domain.Sample{{Lat: 1}}, nil
	}
	return []domain.Sample{sample(1, at), sample(2, at.Add(time.Hour))}, nil
}

type fakeProvider struct{ err error }

func (p fakeProvider) Hourly(_ context.Context, qs []domain.WeatherQuery) ([]domain.WeatherHour, error) {
	out := make([]domain.WeatherHour, len(qs))
	for i, q := range qs {
		out[i] = domain.WeatherHour{Time: q.Time, Lat: q.Lat, TempC: 10}
	}
	return out, p.err
}

func TestFetch(t *testing.T) {
	timed, untimed, bad := uuid.New(), uuid.New(), uuid.New()
	repo := &fakeRepo{saved: map[uuid.UUID][]domain.WeatherHour{}, hikes: []domain.Hike{
		{ID: timed, RawGPX: []byte("2024-07-01T09:00:00Z")},
		{ID: untimed, RawGPX: []byte("")},
		{ID: bad, RawGPX: []byte("bad")},
	}}
	s := NewService(repo, fakeParser{}, fakeProvider{})
	s.pause = 0
	n, err := s.Fetch(context.Background())
	if err != nil || n != 3 {
		t.Fatalf("n = %d, err = %v", n, err)
	}
	if len(repo.saved[timed]) != 2 {
		t.Errorf("timed hike weather = %+v", repo.saved[timed])
	}
	if h, ok := repo.saved[untimed]; !ok || h != nil {
		t.Errorf("untimed hike should be saved empty")
	}
	if _, ok := repo.saved[bad]; !ok {
		t.Errorf("unparsable hike should be saved empty")
	}
}

func TestFetchStopsOnProviderError(t *testing.T) {
	repo := &fakeRepo{saved: map[uuid.UUID][]domain.WeatherHour{}, hikes: []domain.Hike{
		{ID: uuid.New(), RawGPX: []byte("2024-07-01T09:00:00Z")},
	}}
	s := NewService(repo, fakeParser{}, fakeProvider{err: errors.New("429")})
	if _, err := s.Fetch(context.Background()); err == nil || len(repo.saved) != 0 {
		t.Errorf("err = %v, saved = %v", err, repo.saved)
	}
}

func TestSummarizeWeather(t *testing.T) {
	s := domain.SummarizeWeather([]domain.WeatherHour{
		{TempC: 4, PrecipMM: 1, GustKmh: 30, Code: 3},
		{TempC: -2, PrecipMM: 0.5, GustKmh: 50, Code: 61},
	})
	if s.MinTempC != -2 || s.MaxTempC != 4 || s.PrecipMM != 1.5 || s.MaxGustKmh != 50 || s.Code != 61 {
		t.Errorf("summary = %+v", s)
	}
	if domain.SummarizeWeather(nil) != nil {
		t.Error("no weather should have no summary")
	}
}
