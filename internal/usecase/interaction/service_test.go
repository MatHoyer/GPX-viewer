package interaction

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeRepo struct {
	kudos    map[[2]uuid.UUID]bool
	comments []domain.Comment
}

func (f *fakeRepo) Counts(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]domain.HikeInteractions, error) {
	return nil, nil
}
func (f *fakeRepo) AddKudos(_ context.Context, h, u uuid.UUID, _ time.Time) error {
	f.kudos[[2]uuid.UUID{h, u}] = true
	return nil
}
func (f *fakeRepo) RemoveKudos(_ context.Context, h, u uuid.UUID) error {
	delete(f.kudos, [2]uuid.UUID{h, u})
	return nil
}
func (f *fakeRepo) ListComments(context.Context, uuid.UUID) ([]domain.Comment, error) {
	return f.comments, nil
}
func (f *fakeRepo) CreateComment(_ context.Context, c *domain.Comment) error {
	f.comments = append(f.comments, *c)
	return nil
}
func (f *fakeRepo) GetComment(_ context.Context, h, id uuid.UUID) (*domain.Comment, error) {
	for _, c := range f.comments {
		if c.ID == id && c.HikeID == h {
			return &c, nil
		}
	}
	return nil, domain.ErrNotFound
}
func (f *fakeRepo) DeleteComment(_ context.Context, id uuid.UUID) error {
	for i, c := range f.comments {
		if c.ID == id {
			f.comments = append(f.comments[:i], f.comments[i+1:]...)
		}
	}
	return nil
}

// hikes lets everyone in viewers see one hike owned by owner.
type hikes struct {
	id, owner uuid.UUID
	viewers   map[uuid.UUID]bool
}

func (h hikes) Get(_ context.Context, viewer, id uuid.UUID) (*domain.Hike, error) {
	if id != h.id || !h.viewers[viewer] {
		return nil, domain.ErrNotFound
	}
	return &domain.Hike{ID: id, UserID: h.owner}, nil
}

func TestInteractions(t *testing.T) {
	ctx := context.Background()
	owner, friend, other, stranger := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	hike := uuid.New()
	repo := &fakeRepo{kudos: map[[2]uuid.UUID]bool{}}
	svc := NewService(repo, hikes{id: hike, owner: owner, viewers: map[uuid.UUID]bool{owner: true, friend: true, other: true}})

	if err := svc.SetKudos(ctx, friend, hike, true); err != nil || !repo.kudos[[2]uuid.UUID{hike, friend}] {
		t.Errorf("kudos = %v", err)
	}
	if err := svc.SetKudos(ctx, friend, hike, false); err != nil || len(repo.kudos) != 0 {
		t.Errorf("take back kudos = %v", err)
	}
	if err := svc.SetKudos(ctx, stranger, hike, true); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("stranger kudos err = %v", err)
	}

	var ve *domain.ValidationError
	if _, err := svc.Comment(ctx, friend, hike, "   "); !errors.As(err, &ve) {
		t.Errorf("empty comment err = %v", err)
	}
	if _, err := svc.Comment(ctx, friend, hike, strings.Repeat("é", MaxCommentLength+1)); !errors.As(err, &ve) {
		t.Errorf("long comment err = %v", err)
	}
	c, err := svc.Comment(ctx, friend, hike, "  Great views!  ")
	if err != nil || c.Body != "Great views!" {
		t.Fatalf("comment = %+v, %v", c, err)
	}
	if _, err := svc.Comment(ctx, stranger, hike, "hi"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("stranger comment err = %v", err)
	}

	// Only the author and the hike owner can delete a comment.
	if err := svc.DeleteComment(ctx, other, hike, c.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("other delete err = %v", err)
	}
	if err := svc.DeleteComment(ctx, owner, hike, c.ID); err != nil || len(repo.comments) != 0 {
		t.Errorf("owner delete = %v", err)
	}
	mine, _ := svc.Comment(ctx, other, hike, "mine")
	if err := svc.DeleteComment(ctx, other, hike, mine.ID); err != nil {
		t.Errorf("author delete = %v", err)
	}
}
