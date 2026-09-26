package social

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type fakeUsers map[uuid.UUID]*domain.User

func (f fakeUsers) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := f[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func (f fakeUsers) Search(_ context.Context, query string, exclude uuid.UUID, _ int) ([]domain.User, error) {
	var out []domain.User
	for _, u := range f {
		if u.ID != exclude && u.Email == query {
			out = append(out, *u)
		}
	}
	return out, nil
}

type fakeFriends struct{ rows []*domain.Friendship }

func (f *fakeFriends) find(a, b uuid.UUID) int {
	for i, r := range f.rows {
		if (r.RequesterID == a && r.AddresseeID == b) || (r.RequesterID == b && r.AddresseeID == a) {
			return i
		}
	}
	return -1
}

func (f *fakeFriends) Get(_ context.Context, a, b uuid.UUID) (*domain.Friendship, error) {
	if i := f.find(a, b); i >= 0 {
		return f.rows[i], nil
	}
	return nil, domain.ErrNotFound
}

func (f *fakeFriends) Create(_ context.Context, fr *domain.Friendship) error {
	if f.find(fr.RequesterID, fr.AddresseeID) >= 0 {
		return domain.ErrConflict
	}
	f.rows = append(f.rows, fr)
	return nil
}

func (f *fakeFriends) Accept(_ context.Context, requester, addressee uuid.UUID, _ time.Time) error {
	i := f.find(requester, addressee)
	if i < 0 || f.rows[i].RequesterID != requester || f.rows[i].Accepted {
		return domain.ErrNotFound
	}
	f.rows[i].Accepted = true
	return nil
}

func (f *fakeFriends) Delete(_ context.Context, a, b uuid.UUID) error {
	if i := f.find(a, b); i >= 0 {
		f.rows = append(f.rows[:i], f.rows[i+1:]...)
	}
	return nil
}

func (f *fakeFriends) ListConnections(context.Context, uuid.UUID) ([]domain.Connection, error) {
	return nil, nil
}

func setup(visibility domain.Visibility) (*Service, uuid.UUID, uuid.UUID) {
	alice, bob := uuid.New(), uuid.New()
	users := fakeUsers{
		alice: {ID: alice, Email: "alice@x.io", Visibility: visibility},
		bob:   {ID: bob, Email: "bob@x.io", Visibility: domain.VisibilityPrivate},
	}
	return NewService(users, &fakeFriends{}), alice, bob
}

func TestFriendRequestFlow(t *testing.T) {
	ctx := context.Background()
	svc, alice, bob := setup(domain.VisibilityFriends)

	if rel, err := svc.AddFriend(ctx, bob, alice); err != nil || rel != domain.RelationOutgoing {
		t.Fatalf("request = %q, %v", rel, err)
	}
	// Asking again is idempotent.
	if rel, _ := svc.AddFriend(ctx, bob, alice); rel != domain.RelationOutgoing {
		t.Errorf("repeat request = %q", rel)
	}
	p, err := svc.Profile(ctx, alice, bob)
	if err != nil || p.Relation != domain.RelationIncoming {
		t.Fatalf("alice sees bob as %+v, %v", p, err)
	}
	if ok, _ := svc.CanView(ctx, bob, alice); ok {
		t.Error("pending request grants access")
	}

	if rel, err := svc.AddFriend(ctx, alice, bob); err != nil || rel != domain.RelationFriends {
		t.Fatalf("accept = %q, %v", rel, err)
	}
	if ok, _ := svc.CanView(ctx, bob, alice); !ok {
		t.Error("friend cannot see friends-only profile")
	}
	// Bob is private: friendship alone does not open his hikes.
	if ok, _ := svc.CanView(ctx, alice, bob); ok {
		t.Error("friend can see private profile")
	}

	if err := svc.RemoveFriend(ctx, bob, alice); err != nil {
		t.Fatal(err)
	}
	if ok, _ := svc.CanView(ctx, bob, alice); ok {
		t.Error("unfriended user keeps access")
	}
}

func TestAddFriendRejectsSelf(t *testing.T) {
	ctx := context.Background()
	svc, alice, _ := setup(domain.VisibilityPublic)
	var ve *domain.ValidationError
	if _, err := svc.AddFriend(ctx, alice, alice); !errors.As(err, &ve) {
		t.Errorf("self err = %v", err)
	}
}

func TestVisibility(t *testing.T) {
	ctx := context.Background()
	stranger := uuid.New()
	tests := []struct {
		visibility        domain.Visibility
		stranger, visitor bool
	}{
		{domain.VisibilityPrivate, false, false},
		{domain.VisibilityFriends, false, false},
		{domain.VisibilityPublic, true, true},
	}
	for _, tt := range tests {
		svc, alice, _ := setup(tt.visibility)
		if ok, _ := svc.CanView(ctx, alice, alice); !ok {
			t.Errorf("%s: owner cannot see own hikes", tt.visibility)
		}
		if ok, _ := svc.CanView(ctx, stranger, alice); ok != tt.stranger {
			t.Errorf("%s: stranger access = %v", tt.visibility, ok)
		}
		if ok, _ := svc.CanView(ctx, uuid.Nil, alice); ok != tt.visitor {
			t.Errorf("%s: anonymous access = %v", tt.visibility, ok)
		}

		// Signed-in users always see the card; anonymous visitors only public ones.
		if p, err := svc.Profile(ctx, stranger, alice); err != nil || p.CanView != tt.stranger {
			t.Errorf("%s: stranger profile = %+v, %v", tt.visibility, p, err)
		}
		_, err := svc.Profile(ctx, uuid.Nil, alice)
		if tt.visitor != (err == nil) {
			t.Errorf("%s: anonymous profile err = %v", tt.visibility, err)
		}
	}
}

func TestSearchNeedsTwoCharacters(t *testing.T) {
	svc, alice, bob := setup(domain.VisibilityPrivate)
	if got, _ := svc.Search(context.Background(), bob, "a"); len(got) != 0 {
		t.Errorf("one-letter search returned %d users", len(got))
	}
	if got, _ := svc.Search(context.Background(), bob, " alice@x.io "); len(got) != 1 || got[0].ID != alice {
		t.Errorf("email search = %+v", got)
	}
}
