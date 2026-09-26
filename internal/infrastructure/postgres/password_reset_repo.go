package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type PasswordResetRepository struct {
	db *gorm.DB
}

func NewPasswordResetRepository(db *gorm.DB) *PasswordResetRepository {
	return &PasswordResetRepository{db: db}
}

func (r *PasswordResetRepository) Replace(ctx context.Context, p *domain.PasswordReset) error {
	m := PasswordResetModel{UserID: p.UserID, TokenHash: p.TokenHash, ExpiresAt: p.ExpiresAt, CreatedAt: p.CreatedAt}
	return r.db.WithContext(ctx).Omit(clause.Associations).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"token_hash", "expires_at", "created_at"}),
	}).Create(&m).Error
}

func (r *PasswordResetRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.PasswordReset, error) {
	var m PasswordResetModel
	if err := r.db.WithContext(ctx).First(&m, "user_id = ?", userID).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *PasswordResetRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&PasswordResetModel{}, "user_id = ?", userID).Error
}

func (r *PasswordResetRepository) Consume(ctx context.Context, tokenHash string) (*domain.PasswordReset, error) {
	var ms []PasswordResetModel
	err := r.db.WithContext(ctx).Clauses(clause.Returning{}).Where("token_hash = ?", tokenHash).Delete(&ms).Error
	if err != nil {
		return nil, err
	}
	if len(ms) == 0 {
		return nil, domain.ErrNotFound
	}
	return ms[0].toDomain(), nil
}

func (r *PasswordResetRepository) DeleteExpired(ctx context.Context, now time.Time) error {
	return r.db.WithContext(ctx).Delete(&PasswordResetModel{}, "expires_at <= ?", now).Error
}
