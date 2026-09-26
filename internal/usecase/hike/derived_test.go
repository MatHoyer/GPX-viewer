package hike

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func f64(v float64) *float64 { return &v }

// walk is a timed track climbing from 1000m to 1100m over about 220m.
func walk() []domain.Sample {
	t0 := time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)
	var out []domain.Sample
	for i := range 11 {
		ts := t0.Add(time.Duration(i) * 20 * time.Second)
		out = append(out, domain.Sample{Lon: 6, Lat: 45 + float64(i)*0.0002, Ele: f64(1000 + float64(i)*10), Time: &ts})
	}
	return out
}

func TestImportDerivesStats(t *testing.T) {
	parser := fakeParser{res: &domain.ParsedTrack{Segments: twoPoints, ElevationLossM: 42}, samples: walk()}
	h, err := NewService(&fakeRepo{}, parser, ownerOnly{}).Import(context.Background(), uuid.New(), "a.gpx", nil)
	if err != nil {
		t.Fatal(err)
	}
	if h.DerivedVersion != DerivedVersion || h.ElevationLossM != 42 {
		t.Errorf("derived = %+v, version %d", h.HikeDerived, h.DerivedVersion)
	}
	if h.MinEleM == nil || *h.MinEleM != 1000 || h.MaxEleM == nil || *h.MaxEleM != 1100 {
		t.Errorf("ele range = %v..%v", h.MinEleM, h.MaxEleM)
	}
	if h.MovingS == nil || *h.MovingS != 200 {
		t.Errorf("moving = %v", h.MovingS)
	}
}

func TestDeriveWithoutTimeOrElevation(t *testing.T) {
	d := derive(&domain.ParsedTrack{}, []domain.Sample{{Lon: 6, Lat: 45}, {Lon: 6, Lat: 45.001}})
	if d.MinEleM != nil || d.MaxEleM != nil || d.MovingS != nil {
		t.Errorf("derived = %+v", d)
	}
}

func TestRefreshDerived(t *testing.T) {
	ctx := context.Background()
	stale := &domain.Hike{ID: uuid.New(), RawGPX: []byte("ok")}
	current := &domain.Hike{ID: uuid.New(), DerivedVersion: DerivedVersion}
	var hikes []*domain.Hike
	for range refreshBatchSize + 1 {
		hikes = append(hikes, &domain.Hike{ID: uuid.New()})
	}
	repo := &fakeRepo{hikes: append(hikes, stale, current)}
	parser := fakeParser{res: &domain.ParsedTrack{ElevationLossM: 7}, samples: walk()}

	n, err := NewService(repo, parser, ownerOnly{}).RefreshDerived(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if n != refreshBatchSize+2 {
		t.Errorf("refreshed %d hikes", n)
	}
	if stale.DerivedVersion != DerivedVersion || stale.ElevationLossM != 7 || stale.MovingS == nil {
		t.Errorf("stale hike = %+v", stale.HikeDerived)
	}
	if current.ElevationLossM != 0 {
		t.Errorf("current hike recomputed")
	}
}

func TestRefreshDerivedMarksUnparsableHikes(t *testing.T) {
	h := &domain.Hike{ID: uuid.New()}
	repo := &fakeRepo{hikes: []*domain.Hike{h}}
	svc := NewService(repo, fakeParser{err: domain.ErrInvalidGPX}, ownerOnly{})
	if n, err := svc.RefreshDerived(context.Background()); err != nil || n != 1 {
		t.Fatalf("refresh = %d, %v", n, err)
	}
	if h.DerivedVersion != DerivedVersion {
		t.Errorf("unparsable hike left outdated")
	}
}

func TestBestEfforts(t *testing.T) {
	// 6 km north with a fix every 10 s: 10 m per fix, except 20 m per fix
	// (twice as fast) between 2 km and 3 km.
	t0 := time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)
	var samples []domain.Sample
	dist, ts := 0.0, t0
	for dist <= 6000 {
		at := ts
		samples = append(samples, domain.Sample{Lon: 6, Lat: 45 + dist/111195, Time: &at})
		step := 10.0
		if dist >= 2000 && dist < 3000 {
			step = 20
		}
		dist += step
		ts = ts.Add(10 * time.Second)
	}
	got := derive(&domain.ParsedTrack{}, samples).BestEfforts
	if len(got) != 2 || got[0].DistanceM != 1000 || got[1].DistanceM != 5000 {
		t.Fatalf("efforts = %+v", got)
	}
	// 1 km at 2 m/s takes 500 s; 5 km is 1 km fast plus 4 km at 1 m/s.
	if abs(got[0].DurationS-500) > 10 || abs(got[1].DurationS-4500) > 20 {
		t.Errorf("durations = %+v", got)
	}

	// Two fixes 5.56 km and 50 min apart: 1 km at that pace takes 9 min, not 50.
	t1 := t0.Add(50 * time.Minute)
	sparse := derive(&domain.ParsedTrack{}, []domain.Sample{{Lon: 6, Lat: 45, Time: &t0}, {Lon: 6, Lat: 45.05, Time: &t1}}).BestEfforts
	if len(sparse) != 2 || abs(sparse[0].DurationS-540) > 5 || abs(sparse[1].DurationS-2698) > 10 {
		t.Errorf("sparse efforts = %+v", sparse)
	}

	if e := derive(&domain.ParsedTrack{}, []domain.Sample{{Lon: 6, Lat: 45}, {Lon: 6, Lat: 45.1}}).BestEfforts; len(e) != 0 {
		t.Errorf("untimed efforts = %+v", e)
	}
}

func abs(v int) int { return max(v, -v) }
