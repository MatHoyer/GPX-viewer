package hike

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeRepo struct {
	hikes []*domain.Hike
	tags  map[uuid.UUID][]uuid.UUID // hike id -> tagged users
}

func (f *fakeRepo) Create(_ context.Context, h *domain.Hike) error {
	f.hikes = append(f.hikes, h)
	return nil
}

func (f *fakeRepo) ListByUser(_ context.Context, userID uuid.UUID) ([]domain.Hike, error) {
	var out []domain.Hike
	for _, h := range f.hikes {
		if h.UserID == userID || slices.Contains(f.tags[h.ID], userID) {
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

func (f *fakeRepo) Find(_ context.Context, id uuid.UUID) (*domain.Hike, error) {
	for _, h := range f.hikes {
		if h.ID == id {
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

func (f *fakeRepo) ListParticipants(_ context.Context, id uuid.UUID) ([]domain.User, error) {
	var out []domain.User
	for _, u := range f.tags[id] {
		out = append(out, domain.User{ID: u})
	}
	return out, nil
}

func (f *fakeRepo) AddParticipant(_ context.Context, id, user uuid.UUID, _ time.Time) error {
	if f.tags == nil {
		f.tags = map[uuid.UUID][]uuid.UUID{}
	}
	if !slices.Contains(f.tags[id], user) {
		f.tags[id] = append(f.tags[id], user)
	}
	return nil
}

func (f *fakeRepo) RemoveParticipant(_ context.Context, id, user uuid.UUID) error {
	f.tags[id] = slices.DeleteFunc(f.tags[id], func(u uuid.UUID) bool { return u == user })
	return nil
}

func (f *fakeRepo) ListOutdated(_ context.Context, version, limit int) ([]domain.Hike, error) {
	var out []domain.Hike
	for _, h := range f.hikes {
		if h.DerivedVersion < version && len(out) < limit {
			out = append(out, domain.Hike{ID: h.ID, RawGPX: h.RawGPX})
		}
	}
	return out, nil
}

func (f *fakeRepo) SaveDerived(_ context.Context, id uuid.UUID, d domain.HikeDerived, version int) error {
	h, err := f.Find(context.Background(), id)
	if err != nil {
		return err
	}
	h.HikeDerived, h.DerivedVersion = d, version
	return nil
}

// ownerOnly lets users see their own hikes, plus those of anyone in shared.
// Everyone in friends is friends with everyone else in it.
type ownerOnly struct{ shared, friends map[uuid.UUID]bool }

func (a ownerOnly) CanView(_ context.Context, viewer, owner uuid.UUID) (bool, error) {
	return viewer == owner || a.shared[owner], nil
}

func (a ownerOnly) AreFriends(_ context.Context, x, y uuid.UUID) (bool, error) {
	return a.friends[x] && a.friends[y], nil
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

	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Name: " Lac Blanc ", Segments: twoPoints, DistanceM: 1200}}, ownerOnly{})
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
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}}, ownerOnly{})
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
	svc := NewService(&fakeRepo{}, fakeParser{err: domain.ErrInvalidGPX}, ownerOnly{})
	if _, err := svc.Import(ctx, uuid.New(), "a.gpx", nil); !errors.Is(err, domain.ErrInvalidGPX) {
		t.Errorf("err = %v", err)
	}

	onePoint := []domain.Segment{{{Lon: 1, Lat: 1}}}
	svc = NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: onePoint}}, ownerOnly{})
	if _, err := svc.Import(ctx, uuid.New(), "a.gpx", nil); !errors.Is(err, domain.ErrInvalidGPX) {
		t.Errorf("single point err = %v", err)
	}
}

func TestUserScoping(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}}, ownerOnly{})
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
	if list, _ := svc.List(ctx, bob, bob); len(list) != 0 {
		t.Errorf("bob sees %d hikes", len(list))
	}
	if _, err := svc.List(ctx, bob, alice); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob lists alice's hikes: err = %v", err)
	}
	if _, err := svc.Tracks(ctx, uuid.Nil, alice); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("anonymous tracks err = %v", err)
	}
}

func TestSharedHikesAreReadOnly(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	alice, bob := uuid.New(), uuid.New()
	samples := []domain.Sample{{Lon: 6, Lat: 45}, {Lon: 6, Lat: 45.001}}
	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}, samples: samples},
		ownerOnly{shared: map[uuid.UUID]bool{alice: true}})

	h, err := svc.Import(ctx, alice, "a.gpx", []byte("raw"))
	if err != nil {
		t.Fatal(err)
	}
	if got, err := svc.Get(ctx, bob, h.ID); err != nil || got.ID != h.ID {
		t.Errorf("bob get = %+v, %v", got, err)
	}
	if list, err := svc.List(ctx, bob, alice); err != nil || len(list) != 1 {
		t.Errorf("bob list = %d hikes, %v", len(list), err)
	}
	if p, err := svc.Profile(ctx, uuid.Nil, h.ID); err != nil || len(p.Points) != 2 {
		t.Errorf("anonymous profile = %+v, %v", p, err)
	}
	if _, raw, err := svc.GPX(ctx, bob, h.ID); err != nil || string(raw) != "raw" {
		t.Errorf("bob gpx = %q, %v", raw, err)
	}
	if _, err := svc.Rename(ctx, bob, h.ID, "Mine now"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob rename err = %v", err)
	}
	if err := svc.Delete(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob delete err = %v", err)
	}
}

func TestProfileScopedToOwner(t *testing.T) {
	ctx := context.Background()
	samples := []domain.Sample{{Lon: 6, Lat: 45}, {Lon: 6, Lat: 45.001}}
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}, samples: samples}, ownerOnly{})
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
	if _, _, err := svc.GPX(ctx, bob, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("bob gpx err = %v", err)
	}
}

func TestRename(t *testing.T) {
	ctx := context.Background()
	svc := NewService(&fakeRepo{}, fakeParser{res: &domain.ParsedTrack{Name: "Old", Segments: twoPoints}}, ownerOnly{})
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

func TestTagging(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	alice, bob, carol, stranger := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	// Alice is private; Bob's hikes are shared with everyone.
	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}},
		ownerOnly{shared: map[uuid.UUID]bool{bob: true}, friends: map[uuid.UUID]bool{alice: true, bob: true}})

	h, err := svc.Import(ctx, alice, "a.gpx", nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Get(ctx, stranger, h.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("stranger sees untagged private hike: err = %v", err)
	}

	var ve *domain.ValidationError
	if err := svc.Tag(ctx, alice, h.ID, carol); !errors.As(err, &ve) {
		t.Errorf("tag non-friend err = %v", err)
	}
	if err := svc.Tag(ctx, alice, h.ID, alice); !errors.As(err, &ve) {
		t.Errorf("tag self err = %v", err)
	}
	if err := svc.Tag(ctx, bob, h.ID, alice); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("non-owner tag err = %v", err)
	}
	if err := svc.Tag(ctx, alice, h.ID, bob); err != nil {
		t.Fatal(err)
	}

	if list, _ := svc.List(ctx, bob, bob); len(list) != 1 {
		t.Errorf("tagged hike not in bob's list: %d hikes", len(list))
	}
	// Tagging Bob shares the hike with whoever can see Bob's hikes.
	got, err := svc.Get(ctx, stranger, h.ID)
	if err != nil || len(got.Participants) != 1 || got.Participants[0].ID != bob {
		t.Fatalf("get via participant = %+v, %v", got, err)
	}
	if _, err := svc.Rename(ctx, bob, h.ID, "Mine now"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("participant rename err = %v", err)
	}

	if err := svc.Untag(ctx, stranger, h.ID, bob); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("stranger untag err = %v", err)
	}
	if err := svc.Untag(ctx, bob, h.ID, bob); err != nil {
		t.Fatal(err)
	}
	if list, _ := svc.List(ctx, bob, bob); len(list) != 0 {
		t.Errorf("untagged hike still in bob's list")
	}
}

func TestExportOwnedOnly(t *testing.T) {
	ctx := context.Background()
	repo := &fakeRepo{}
	alice, bob := uuid.New(), uuid.New()
	svc := NewService(repo, fakeParser{res: &domain.ParsedTrack{Segments: twoPoints}},
		ownerOnly{friends: map[uuid.UUID]bool{alice: true, bob: true}})

	mine, err := svc.Import(ctx, alice, "mine.gpx", []byte("mine"))
	if err != nil {
		t.Fatal(err)
	}
	theirs, err := svc.Import(ctx, bob, "theirs.gpx", []byte("theirs"))
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Tag(ctx, bob, theirs.ID, alice); err != nil {
		t.Fatal(err)
	}

	var got []string
	err = svc.Export(ctx, alice, func(h *domain.Hike, raw []byte) error {
		got = append(got, h.ID.String()+":"+string(raw))
		return nil
	})
	if err != nil || len(got) != 1 || got[0] != mine.ID.String()+":mine" {
		t.Errorf("export = %v, %v", got, err)
	}
}
