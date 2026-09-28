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
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	if s.LastUsedAt.IsZero() {
		s.LastUsedAt = s.CreatedAt
	}
	m := SessionModel{
		TokenHash:  s.TokenHash,
		ID:         s.ID,
		UserID:     s.UserID,
		UserAgent:  s.UserAgent,
		IP:         s.IP,
		ExpiresAt:  s.ExpiresAt,
		LastUsedAt: &s.LastUsedAt,
		CreatedAt:  s.CreatedAt,
	}
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(&m).Error
}

func (r *SessionRepository) ListByUserID(ctx context.Context, userID uuid.UUID, now time.Time) ([]domain.Session, error) {
	var ms []SessionModel
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND expires_at > ?", userID, now).
		Order("COALESCE(last_used_at, created_at) DESC").
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Session, len(ms))
	for i := range ms {
		out[i] = *ms[i].toDomain()
	}
	return out, nil
}

func (r *SessionRepository) Touch(ctx context.Context, tokenHash string, at time.Time, ip string) error {
	return r.db.WithContext(ctx).Model(&SessionModel{}).Where("token_hash = ?", tokenHash).
		Updates(map[string]any{"last_used_at": at, "ip": ip}).Error
}

func (r *SessionRepository) DeleteByID(ctx context.Context, userID, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&SessionModel{}, "user_id = ? AND id = ?", userID, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *SessionRepository) DeleteOthers(ctx context.Context, userID uuid.UUID, keepTokenHash string) error {
	return r.db.WithContext(ctx).Delete(&SessionModel{}, "user_id = ? AND token_hash <> ?", userID, keepTokenHash).Error
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
