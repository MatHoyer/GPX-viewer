package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type SessionRepository struct {
	db *gorm.DB
}

func NewSessionRepository(db *gorm.DB) *SessionRepository { return &SessionRepository{db: db} }

func (r *SessionRepository) Create(ctx context.Context, s *domain.Session) error {
	m := SessionModel{TokenHash: s.TokenHash, UserID: s.UserID, ExpiresAt: s.ExpiresAt, CreatedAt: s.CreatedAt}
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(&m).Error
}

func (r *SessionRepository) GetByTokenHash(ctx context.Context, tokenHash string) (*domain.Session, error) {
	var m SessionModel
	if err := r.db.WithContext(ctx).First(&m, "token_hash = ?", tokenHash).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *SessionRepository) Delete(ctx context.Context, tokenHash string) error {
	return r.db.WithContext(ctx).Delete(&SessionModel{}, "token_hash = ?", tokenHash).Error
}

func (r *SessionRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&SessionModel{}, "user_id = ?", userID).Error
}

func (r *SessionRepository) DeleteExpired(ctx context.Context, now time.Time) error {
	return r.db.WithContext(ctx).Delete(&SessionModel{}, "expires_at <= ?", now).Error
}
