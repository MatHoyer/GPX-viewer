package postgres

import (
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type UserModel struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey"`
	Email        string    `gorm:"not null;uniqueIndex"`
	Name         string    `gorm:"not null;default:''"`
	PasswordHash string    `gorm:"not null"`
	Visibility   string    `gorm:"not null;default:private"`
	Language     string    `gorm:"not null;default:''"`
	// EmailVerifiedAt is nil until the email verification link is followed.
	EmailVerifiedAt *time.Time
	IsAdmin         bool `gorm:"not null;default:false"`
	BannedAt        *time.Time
	BanReason       string `gorm:"not null;default:''"`
	InvitedAt       *time.Time
	CreatedAt       time.Time `gorm:"not null"`
}

func (UserModel) TableName() string { return "users" }

func (m UserModel) toDomain() *domain.User {
	return &domain.User{
		ID:              m.ID,
		Email:           m.Email,
		Name:            m.Name,
		PasswordHash:    m.PasswordHash,
		Visibility:      domain.Visibility(m.Visibility),
		Language:        domain.Language(m.Language),
		EmailVerifiedAt: m.EmailVerifiedAt,
		IsAdmin:         m.IsAdmin,
		BannedAt:        m.BannedAt,
		BanReason:       m.BanReason,
		InvitedAt:       m.InvitedAt,
		CreatedAt:       m.CreatedAt,
	}
}

// FriendshipModel is a friend request; AcceptedAt is set once accepted. A
// unique index on the unordered pair (see Migrate) allows one row per pair.
type FriendshipModel struct {
	RequesterID uuid.UUID `gorm:"type:uuid;primaryKey"`
	Requester   UserModel `gorm:"foreignKey:RequesterID;constraint:OnDelete:CASCADE"`
	AddresseeID uuid.UUID `gorm:"type:uuid;primaryKey;index"`
	Addressee   UserModel `gorm:"foreignKey:AddresseeID;constraint:OnDelete:CASCADE"`
	CreatedAt   time.Time `gorm:"not null"`
	AcceptedAt  *time.Time
}

func (FriendshipModel) TableName() string { return "friendships" }

func (m FriendshipModel) toDomain() *domain.Friendship {
	return &domain.Friendship{
		RequesterID: m.RequesterID,
		AddresseeID: m.AddresseeID,
		Accepted:    m.AcceptedAt != nil,
		CreatedAt:   m.CreatedAt,
	}
}

type SessionModel struct {
	TokenHash string    `gorm:"primaryKey"`
	ID        uuid.UUID `gorm:"type:uuid;not null;default:gen_random_uuid();uniqueIndex"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	UserAgent string    `gorm:"not null;default:''"`
	IP        string    `gorm:"not null;default:''"`
	ExpiresAt time.Time `gorm:"not null;index"`
	// LastUsedAt is nil on sessions from before it was tracked.
	LastUsedAt *time.Time
	CreatedAt  time.Time `gorm:"not null"`
}

func (SessionModel) TableName() string { return "sessions" }

func (m SessionModel) toDomain() *domain.Session {
	lastUsed := m.CreatedAt
	if m.LastUsedAt != nil {
		lastUsed = *m.LastUsedAt
	}
	return &domain.Session{
		ID:         m.ID,
		TokenHash:  m.TokenHash,
		UserID:     m.UserID,
		UserAgent:  m.UserAgent,
		IP:         m.IP,
		ExpiresAt:  m.ExpiresAt,
		LastUsedAt: lastUsed,
		CreatedAt:  m.CreatedAt,
	}
}

// EmailVerificationModel is a pending verification link, one per user.
type EmailVerificationModel struct {
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	TokenHash string    `gorm:"not null;uniqueIndex"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time `gorm:"not null"`
}

func (EmailVerificationModel) TableName() string { return "email_verifications" }

func (m EmailVerificationModel) toDomain() *domain.EmailVerification {
	return &domain.EmailVerification{TokenHash: m.TokenHash, UserID: m.UserID, ExpiresAt: m.ExpiresAt, CreatedAt: m.CreatedAt}
}

// PasswordResetModel is a pending password reset link, one per user.
type PasswordResetModel struct {
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	TokenHash string    `gorm:"not null;uniqueIndex"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time `gorm:"not null"`
}

func (PasswordResetModel) TableName() string { return "password_resets" }

func (m PasswordResetModel) toDomain() *domain.PasswordReset {
	return &domain.PasswordReset{TokenHash: m.TokenHash, UserID: m.UserID, ExpiresAt: m.ExpiresAt, CreatedAt: m.CreatedAt}
}

type HikeModel struct {
	ID             uuid.UUID             `gorm:"type:uuid;primaryKey"`
	UserID         uuid.UUID             `gorm:"type:uuid;not null;index"`
	User           UserModel             `gorm:"constraint:OnDelete:CASCADE"`
	Name           string                `gorm:"not null"`
	DistanceM      float64               `gorm:"type:double precision;not null"`
	ElevationGainM float64               `gorm:"type:double precision;not null"`
	StartedAt      *time.Time            `gorm:"index"`
	DurationS      int64                 `gorm:"not null"`
	Notes          string                `gorm:"not null;default:''"`
	Planned        bool                  `gorm:"not null;default:false"`
	Labels         []HikeLabelModel      `gorm:"foreignKey:HikeID;constraint:OnDelete:CASCADE"`
	BestEfforts    []HikeBestEffortModel `gorm:"foreignKey:HikeID;constraint:OnDelete:CASCADE"`
	Tiles          []HikeTileModel       `gorm:"foreignKey:HikeID;constraint:OnDelete:CASCADE"`
	ElevationLossM float64               `gorm:"type:double precision;not null;default:0"`
	MinEleM        *float64              `gorm:"type:double precision"`
	MaxEleM        *float64              `gorm:"type:double precision"`
	MovingS        *int64
	DerivedVersion int              `gorm:"not null;default:0;index"`
	MinLon         float64          `gorm:"type:double precision;not null"`
	MinLat         float64          `gorm:"type:double precision;not null"`
	MaxLon         float64          `gorm:"type:double precision;not null"`
	MaxLat         float64          `gorm:"type:double precision;not null"`
	Geom           MultiLineStringZ `gorm:"type:geometry(MultiLineStringZ,4326);not null;index:idx_hikes_geom,type:gist"`
	GPXRaw         []byte           `gorm:"column:gpx_raw;type:bytea"`
	CreatedAt      time.Time        `gorm:"not null"`
}

func (HikeModel) TableName() string { return "hikes" }

// HikeParticipantModel tags a user on someone else's hike.
type HikeParticipantModel struct {
	HikeID    uuid.UUID `gorm:"type:uuid;primaryKey"`
	Hike      HikeModel `gorm:"constraint:OnDelete:CASCADE"`
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey;index"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	CreatedAt time.Time `gorm:"not null"`
}

func (HikeParticipantModel) TableName() string { return "hike_participants" }

// HikeLabelModel is one of the owner's labels on a hike.
type HikeLabelModel struct {
	HikeID uuid.UUID `gorm:"type:uuid;primaryKey"`
	Label  string    `gorm:"primaryKey"`
}

func (HikeLabelModel) TableName() string { return "hike_labels" }

// HikeBestEffortModel is a hike's fastest time over a standard distance.
type HikeBestEffortModel struct {
	HikeID    uuid.UUID `gorm:"type:uuid;primaryKey"`
	DistanceM int       `gorm:"primaryKey"`
	DurationS int       `gorm:"not null"`
}

func (HikeBestEffortModel) TableName() string { return "hike_best_efforts" }

// HikeTileModel is a zoom-14 map tile a hike's track passes through.
type HikeTileModel struct {
	HikeID uuid.UUID `gorm:"type:uuid;primaryKey"`
	X      int       `gorm:"primaryKey;autoIncrement:false"`
	Y      int       `gorm:"primaryKey;autoIncrement:false"`
}

func (HikeTileModel) TableName() string { return "hike_tiles" }

func bestEffortsToDomain(ms []HikeBestEffortModel) []domain.BestEffort {
	out := make([]domain.BestEffort, len(ms))
	for i, m := range ms {
		out[i] = domain.BestEffort{DistanceM: m.DistanceM, DurationS: m.DurationS}
	}
	return out
}

func bestEffortModels(id uuid.UUID, efforts []domain.BestEffort) []HikeBestEffortModel {
	out := make([]HikeBestEffortModel, len(efforts))
	for i, e := range efforts {
		out[i] = HikeBestEffortModel{HikeID: id, DistanceM: e.DistanceM, DurationS: e.DurationS}
	}
	return out
}

func (m HikeModel) toDomain() domain.Hike {
	labels := make([]string, len(m.Labels))
	for i, l := range m.Labels {
		labels[i] = l.Label
	}
	var owner *domain.User
	if m.User.ID != uuid.Nil {
		owner = m.User.toDomain()
	}
	return domain.Hike{
		Owner:          owner,
		ID:             m.ID,
		UserID:         m.UserID,
		Name:           m.Name,
		DistanceM:      m.DistanceM,
		ElevationGainM: m.ElevationGainM,
		StartedAt:      m.StartedAt,
		DurationS:      m.DurationS,
		Notes:          m.Notes,
		Planned:        m.Planned,
		Labels:         labels,
		HikeDerived: domain.HikeDerived{
			ElevationLossM: m.ElevationLossM,
			MinEleM:        m.MinEleM,
			MaxEleM:        m.MaxEleM,
			MovingS:        m.MovingS,
			BestEfforts:    bestEffortsToDomain(m.BestEfforts),
		},
		DerivedVersion: m.DerivedVersion,
		Bounds:         domain.Bounds{MinLon: m.MinLon, MinLat: m.MinLat, MaxLon: m.MaxLon, MaxLat: m.MaxLat},
		RawGPX:         m.GPXRaw,
		CreatedAt:      m.CreatedAt,
	}
}

// PeakModel is a named OpenStreetMap peak. Geom is only written and queried
// in SQL, so it is kept as its text form here.
type PeakModel struct {
	ID   int64    `gorm:"primaryKey;autoIncrement:false"`
	Name string   `gorm:"not null"`
	EleM *float64 `gorm:"type:double precision"`
	Geom string   `gorm:"type:geometry(Point,4326);not null;index:idx_peaks_geom,type:gist"`
}

func (PeakModel) TableName() string { return "peaks" }

// HikeKudosModel is one user's kudos on a hike.
type HikeKudosModel struct {
	HikeID    uuid.UUID `gorm:"type:uuid;primaryKey"`
	Hike      HikeModel `gorm:"constraint:OnDelete:CASCADE"`
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey;index"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	CreatedAt time.Time `gorm:"not null"`
}

func (HikeKudosModel) TableName() string { return "hike_kudos" }

// HikeCommentModel is a comment on a hike.
type HikeCommentModel struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey"`
	HikeID    uuid.UUID `gorm:"type:uuid;not null;index"`
	Hike      HikeModel `gorm:"constraint:OnDelete:CASCADE"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	Body      string    `gorm:"not null"`
	CreatedAt time.Time `gorm:"not null"`
}

func (HikeCommentModel) TableName() string { return "hike_comments" }

func (m HikeCommentModel) toDomain() domain.Comment {
	c := domain.Comment{ID: m.ID, HikeID: m.HikeID, UserID: m.UserID, Body: m.Body, CreatedAt: m.CreatedAt}
	if m.User.ID != uuid.Nil {
		c.Author = m.User.toDomain()
	}
	return c
}
