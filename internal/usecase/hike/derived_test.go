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
