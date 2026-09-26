package hike

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeRepo struct{ hikes []*domain.Hike }

func (f *fakeRepo) Create(_ context.Context, h *domain.Hike) error {
	f.hikes = append(f.hikes, h)
	return nil
}

func (f *fakeRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]domain.Hike, error) {
	var out []domain.Hike
	for _, h := range f.hikes {
		if h.UserID == userID {
			out = append(out, *h)
		}
	}
	return out, nil
}

func (f *fakeRepo) GetByID(_ context.Context, userID, id uuid.UUID) (*domain.Hike, error) {
	for _, h := range f.hikes {
		if h.UserID == userID && h.ID == id {
			return h, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (f *fakeRepo) Delete(_ context.Context, userID, id uuid.UUID) error {
	for i, h := range f.hikes {
		if h.UserID == userID && h.ID == id {
			f.hikes = append(f.hikes[:i], f.hikes[i+1:]...)
			return nil
		}
	}
	return domain.ErrNotFound
}

func (f *fakeRepo) Rename(ctx context.Context, userID, id uuid.UUID, name string) error {
	h, err := f.GetByID(ctx, userID, id)
	if err != nil {
		return err
	}
	h.Name = name
	return nil
}

func (f *fakeRepo) GetRawGPX(ctx context.Context, userID, id uuid.UUID) ([]byte, error) {
	h, err := f.GetByID(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	return h.RawGPX, nil
}

func (f *fakeRepo) ListTracks(context.Context, uuid.UUID, float64) ([]domain.HikeTrack, error) {
	return nil, nil
}

type fakeParser struct {
	res     *domain.ParsedTrack
	err     error
	samples []domain.Sample
}

func (p fakeParser) Parse([]byte) (*domain.ParsedTrack, error) { return p.res, p.err }
func (p fakeParser) Samples([]byte) ([]domain.Sample, error)   { return p.samples, p.err }

var twoPoints = []domain.Segment{{{Lon: 6, Lat: 45}, {Lon: 7, Lat: 46, Ele: 10}}}

func TestImport(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	user := uuid.New()

	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Name: " Lac Blanc ", Segments: twoPoints, DistanceM: 1200}})
	h, err := svc.Import(ctx, user, "x.gpx", []byte("raw"))
	if err != nil {
		t.Fatal(err)
	}
	if h.Name != "Lac Blanc" || h.UserID != user || string(h.RawGPX) != "raw" || h.DistanceM != 1200 {
		t.Errorf("unexpected hike: %+v", h)
	}
	if h.Bounds != (domain.Bounds{MinLon: 6, MinLat: 45, MaxLon: 7, MaxLat: 46}) {
		t.Errorf("bounds = %+v", h.Bounds)
	}
	if len(repo.hikes) != 1 {
		t.Errorf("hike not stored")
	}
}

func TestImportNameFallsBackToFilename(t *testing.T) {
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}})
	h, err := svc.Import(context.Background(), uuid.New(), "dir/Morning hike.gpx", nil)
	if err != nil {
		t.Fatal(err)
	}
	if h.Name != "Morning hike" {
		t.Errorf("name = %q", h.Name)
	}
}

func TestImportRejectsInvalid(t *testing.T) {
	ctx := context.Background()
	svc := NewService(&fakeRepo{}, fakeParser{err: domain.ErrInvalidGPX})
	if _, err := svc.Import(ctx, uuid.New(), "a.gpx", nil); !errors.Is(err, domain.ErrInvalidGPX) {
		t.Errorf("err = %v", err)
	}

	onePoint := []domain.Segment{{{Lon: 1, Lat: 1}}}
	svc = NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: onePoint}})
	if _, err := svc.Import(ctx, uuid.New(), "a.gpx", nil); !errors.Is(err, domain.ErrInvalidGPX) {
		t.Errorf("single point err = %v", err)
	}
}

func TestUserScoping(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}})
	alice, bob := uuid.New(), uuid.New()

	h, err := svc.Import(ctx, alice, "a.gpx", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob get err = %v", err)
	}
	if err := svc.Delete(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob delete err = %v", err)
	}
	if list, _ := svc.List(ctx, bob); len(list) != 0 {
		t.Errorf("bob sees %d hikes", len(list))
	}
}

func TestProfileScopedToOwner(t *testing.T) {
	ctx := context.Background()
	samples := []domain.Sample{{Lon: 6, Lat: 45}, {Lon: 6, Lat: 45.001}}
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}, samples: samples})
	alice, bob := uuid.New(), uuid.New()

	h, err := svc.Import(ctx, alice, "a.gpx", []byte("raw"))
	if err != nil {
		t.Fatal(err)
	}
	p, err := svc.Profile(ctx, alice, h.ID)
	if err != nil || len(p.Points) != 2 {
		t.Fatalf("profile = %+v, %v", p, err)
	}
	if _, err := svc.Profile(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob profile err = %v", err)
	}
}

func TestRename(t *testing.T) {
	ctx := context.Background()
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Name: "Old", Segments: twoPoints}})
	alice, bob := uuid.New(), uuid.New()
	h, err := svc.Import(ctx, alice, "a.gpx", nil)
	if err != nil {
		t.Fatal(err)
	}

	got, err := svc.Rename(ctx, alice, h.ID, "  Lac Blanc  ")
	if err != nil || got.Name != "Lac Blanc" {
		t.Fatalf("rename = %+v, %v", got, err)
	}

	var ve *domain.ValidationError
	if _, err := svc.Rename(ctx, alice, h.ID, "   "); !errors.As(err, &ve) {
		t.Errorf("empty name err = %v", err)
	}
	if _, err := svc.Rename(ctx, alice, h.ID, strings.Repeat("é", MaxNameLength+1)); !errors.As(err, &ve) {
		t.Errorf("long name err = %v", err)
	}
	if _, err := svc.Rename(ctx, alice, h.ID, strings.Repeat("é", MaxNameLength)); err != nil {
		t.Errorf("max length name err = %v", err)
	}
	if _, err := svc.Rename(ctx, bob, h.ID, "Mine now"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob rename err = %v", err)
	}
}
