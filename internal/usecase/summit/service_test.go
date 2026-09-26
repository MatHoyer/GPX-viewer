package summit

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakePeaks struct{ stored []domain.Peak }

func (f *fakePeaks) Upsert(_ context.Context, p []domain.Peak) error {
	f.stored = append(f.stored, p...)
	return nil
}
func (f *fakePeaks) OnHike(context.Context, uuid.UUID, float64) ([]domain.Peak, error) {
	return f.stored, nil
}
func (f *fakePeaks) OfUser(context.Context, uuid.UUID, float64) ([]domain.Summit, error) {
	return nil, nil
}

type fakeSource []domain.Peak

func (s fakeSource) Peaks(context.Context, domain.Bounds) ([]domain.Peak, error) { return s, nil }

type visible map[uuid.UUID]bool

func (v visible) Get(_ context.Context, _, id uuid.UUID) (*domain.Hike, error) {
	if !v[id] {
		return nil, domain.ErrNotFound
	}
	return &domain.Hike{ID: id}, nil
}

func TestImportAndOnHike(t *testing.T) {
	ctx := context.Background()
	peaks := &fakePeaks{}
	hike := uuid.New()
	svc := NewService(peaks, fakeSource{{ID: 1, Name: "A"}, {ID: 2, Name: "B"}}, visible{hike: true})

	if _, err := svc.Import(ctx, domain.Bounds{MinLon: 7, MinLat: 45, MaxLon: 6, MaxLat: 46}); err == nil {
		t.Error("imported an inverted bounding box")
	}
	if n, err := svc.Import(ctx, domain.Bounds{MinLon: 6, MinLat: 45, MaxLon: 7, MaxLat: 46}); err != nil || n != 2 || len(peaks.stored) != 2 {
		t.Fatalf("import = %d, %v", n, err)
	}
	if got, err := svc.OnHike(ctx, uuid.Nil, hike); err != nil || len(got) != 2 {
		t.Errorf("on hike = %+v, %v", got, err)
	}
	if _, err := svc.OnHike(ctx, uuid.Nil, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("hidden hike err = %v", err)
	}
}
