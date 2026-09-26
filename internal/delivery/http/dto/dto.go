package dto

import (
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type VerifyEmail struct {
	Token string `json:"token"`
}

type ForgotPassword struct {
	Email string `json:"email"`
}

type ResetPassword struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type ChangePassword struct {
	CurrentPassword string `json:"currentPassword"`
	Password        string `json:"password"`
}

type User struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	Visibility string    `json:"visibility"`
	CreatedAt  time.Time `json:"createdAt"`
}

func NewUser(u *domain.User) User {
	return User{
		ID:         u.ID.String(),
		Email:      u.Email,
		Name:       u.Name,
		Visibility: string(u.Visibility),
		CreatedAt:  u.CreatedAt,
	}
}

// PublicUser is what other users get to see of someone: never their email.
type PublicUser struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

func NewPublicUser(u *domain.User) PublicUser {
	return PublicUser{
		ID:        u.ID.String(),
		Name:      u.Name,
		CreatedAt: u.CreatedAt,
	}
}

func NewPublicUsers(us []domain.User) []PublicUser {
	out := make([]PublicUser, len(us))
	for i := range us {
		out[i] = NewPublicUser(&us[i])
	}
	return out
}

// UserProfile is a user as seen by the viewer. CanView is false when their
// hikes are hidden from the viewer.
type UserProfile struct {
	User       PublicUser `json:"user"`
	Visibility string     `json:"visibility"`
	Relation   string     `json:"relation"`
	CanView    bool       `json:"canView"`
}

// Connections groups the viewer's friends and pending requests.
type Connections struct {
	Friends  []PublicUser `json:"friends"`
	Incoming []PublicUser `json:"incoming"`
	Outgoing []PublicUser `json:"outgoing"`
}

func NewConnections(cs []domain.Connection) Connections {
	out := Connections{Friends: []PublicUser{}, Incoming: []PublicUser{}, Outgoing: []PublicUser{}}
	for i := range cs {
		u := NewPublicUser(&cs[i].User)
		switch cs[i].Relation {
		case domain.RelationFriends:
			out.Friends = append(out.Friends, u)
		case domain.RelationIncoming:
			out.Incoming = append(out.Incoming, u)
		case domain.RelationOutgoing:
			out.Outgoing = append(out.Outgoing, u)
		}
	}
	return out
}

type Relation struct {
	Relation string `json:"relation"`
}

// UpdateAccount is a partial update; nil fields are left unchanged.
type UpdateAccount struct {
	Name       *string `json:"name"`
	Visibility *string `json:"visibility"`
}

type Error struct {
	Error string `json:"error"`
	Field string `json:"field,omitempty"`
}

type Hike struct {
	ID             string     `json:"id"`
	UserID         string     `json:"userId"`
	Name           string     `json:"name"`
	DistanceM      float64    `json:"distanceM"`
	ElevationGainM float64    `json:"elevationGainM"`
	StartedAt      *time.Time `json:"startedAt"`
	DurationS      int64      `json:"durationS"`
	Notes          string     `json:"notes"`
	Labels         []string   `json:"labels"`
	ElevationLossM float64    `json:"elevationLossM"`
	MinEleM        *float64   `json:"minEleM"`
	MaxEleM        *float64   `json:"maxEleM"`
	MovingS        *int64     `json:"movingS"`
	// Bounds is [minLon, minLat, maxLon, maxLat].
	Bounds    [4]float64 `json:"bounds"`
	CreatedAt time.Time  `json:"createdAt"`
	// Owner is omitted on hikes just created by an upload.
	Owner *PublicUser `json:"owner,omitempty"`
	// Participants is only set on single-hike reads.
	Participants []PublicUser `json:"participants,omitempty"`
}

func NewHike(h *domain.Hike) Hike {
	var owner *PublicUser
	if h.Owner != nil {
		o := NewPublicUser(h.Owner)
		owner = &o
	}
	labels := h.Labels
	if labels == nil {
		labels = []string{}
	}
	return Hike{
		Owner:          owner,
		ID:             h.ID.String(),
		UserID:         h.UserID.String(),
		Name:           h.Name,
		DistanceM:      h.DistanceM,
		ElevationGainM: h.ElevationGainM,
		StartedAt:      h.StartedAt,
		DurationS:      h.DurationS,
		Notes:          h.Notes,
		Labels:         labels,
		ElevationLossM: h.ElevationLossM,
		MinEleM:        h.MinEleM,
		MaxEleM:        h.MaxEleM,
		MovingS:        h.MovingS,
		Bounds:         [4]float64{h.Bounds.MinLon, h.Bounds.MinLat, h.Bounds.MaxLon, h.Bounds.MaxLat},
		CreatedAt:      h.CreatedAt,
		Participants:   NewPublicUsers(h.Participants),
	}
}

// UpdateHike is a partial update; nil fields are left unchanged.
type UpdateHike struct {
	Name   *string   `json:"name"`
	Notes  *string   `json:"notes"`
	Labels *[]string `json:"labels"`
}

type UploadResult struct {
	Filename string `json:"filename"`
	Hike     *Hike  `json:"hike,omitempty"`
	Error    string `json:"error,omitempty"`
}

// GeoJSON FeatureCollection of MultiLineStrings.
type FeatureCollection struct {
	Type     string    `json:"type"`
	Features []Feature `json:"features"`
}

type Feature struct {
	Type       string            `json:"type"`
	ID         string            `json:"id"`
	Geometry   MultiLineString   `json:"geometry"`
	Properties FeatureProperties `json:"properties"`
}

type MultiLineString struct {
	Type        string         `json:"type"`
	Coordinates [][][2]float64 `json:"coordinates"`
}

type FeatureProperties struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func NewFeatureCollection(tracks []domain.HikeTrack) FeatureCollection {
	fc := FeatureCollection{Type: "FeatureCollection", Features: make([]Feature, 0, len(tracks))}
	for _, t := range tracks {
		coords := make([][][2]float64, 0, len(t.Segments))
		for _, seg := range t.Segments {
			line := make([][2]float64, len(seg))
			for i, p := range seg {
				line[i] = [2]float64{p.Lon, p.Lat}
			}
			coords = append(coords, line)
		}
		id := t.ID.String()
		fc.Features = append(fc.Features, Feature{
			Type:       "Feature",
			ID:         id,
			Geometry:   MultiLineString{Type: "MultiLineString", Coordinates: coords},
			Properties: FeatureProperties{ID: id, Name: t.Name},
		})
	}
	return fc
}
