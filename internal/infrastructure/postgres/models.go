package postgres

import (
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type UserModel struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey"`
	Email           string    `gorm:"not null;uniqueIndex"`
	Name            string    `gorm:"not null;default:''"`
	PasswordHash    string    `gorm:"not null"`
	AvatarUpdatedAt *time.Time
	CreatedAt       time.Time `gorm:"not null"`
}

func (UserModel) TableName() string { return "users" }

func (m UserModel) toDomain() *domain.User {
	return &domain.User{
		ID:              m.ID,
		Email:           m.Email,
		Name:            m.Name,
		PasswordHash:    m.PasswordHash,
		AvatarUpdatedAt: m.AvatarUpdatedAt,
		CreatedAt:       m.CreatedAt,
	}
}

// UserAvatarModel lives in its own table so user lookups (one per authenticated
// request) never load image bytes.
type UserAvatarModel struct {
	UserID      uuid.UUID `gorm:"type:uuid;primaryKey"`
	User        UserModel `gorm:"constraint:OnDelete:CASCADE"`
	ContentType string    `gorm:"not null"`
	Data        []byte    `gorm:"type:bytea;not null"`
	UpdatedAt   time.Time `gorm:"not null;autoUpdateTime:false"`
}

func (UserAvatarModel) TableName() string { return "user_avatars" }

type SessionModel struct {
	TokenHash string    `gorm:"primaryKey"`
	UserID    uuid.UUID `gorm:"type:uuid;not null;index"`
	User      UserModel `gorm:"constraint:OnDelete:CASCADE"`
	ExpiresAt time.Time `gorm:"not null;index"`
	CreatedAt time.Time `gorm:"not null"`
}

func (SessionModel) TableName() string { return "sessions" }

func (m SessionModel) toDomain() *domain.Session {
	return &domain.Session{TokenHash: m.TokenHash, UserID: m.UserID, ExpiresAt: m.ExpiresAt, CreatedAt: m.CreatedAt}
}

type HikeModel struct {
	ID             uuid.UUID        `gorm:"type:uuid;primaryKey"`
	UserID         uuid.UUID        `gorm:"type:uuid;not null;index"`
	User           UserModel        `gorm:"constraint:OnDelete:CASCADE"`
	Name           string           `gorm:"not null"`
	DistanceM      float64          `gorm:"type:double precision;not null"`
	ElevationGainM float64          `gorm:"type:double precision;not null"`
	StartedAt      *time.Time       `gorm:"index"`
	DurationS      int64            `gorm:"not null"`
	MinLon         float64          `gorm:"type:double precision;not null"`
	MinLat         float64          `gorm:"type:double precision;not null"`
	MaxLon         float64          `gorm:"type:double precision;not null"`
	MaxLat         float64          `gorm:"type:double precision;not null"`
	Geom           MultiLineStringZ `gorm:"type:geometry(MultiLineStringZ,4326);not null;index:idx_hikes_geom,type:gist"`
	GPXRaw         []byte           `gorm:"column:gpx_raw;type:bytea"`
	CreatedAt      time.Time        `gorm:"not null"`
}

func (HikeModel) TableName() string { return "hikes" }

func (m HikeModel) toDomain() domain.Hike {
	return domain.Hike{
		ID:             m.ID,
		UserID:         m.UserID,
		Name:           m.Name,
		DistanceM:      m.DistanceM,
		ElevationGainM: m.ElevationGainM,
		StartedAt:      m.StartedAt,
		DurationS:      m.DurationS,
		Bounds:         domain.Bounds{MinLon: m.MinLon, MinLat: m.MinLat, MaxLon: m.MaxLon, MaxLat: m.MaxLat},
		RawGPX:         m.GPXRaw,
		CreatedAt:      m.CreatedAt,
	}
}
