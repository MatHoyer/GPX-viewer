package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type EmailVerificationRepository struct {
	db *gorm.DB
}

func NewEmailVerificationRepository(db *gorm.DB) *EmailVerificationRepository {
	return &EmailVerificationRepository{db: db}
}

func (r *EmailVerificationRepository) Replace(ctx context.Context, v *domain.EmailVerification) error {
	m := EmailVerificationModel{UserID: v.UserID, TokenHash: v.TokenHash, ExpiresAt: v.ExpiresAt, CreatedAt: v.CreatedAt}
	return r.db.WithContext(ctx).Omit(clause.Associations).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"token_hash", "expires_at", "created_at"}),
	}).Create(&m).Error
}

func (r *EmailVerificationRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*domain.EmailVerification, error) {
	var m EmailVerificationModel
	if err := r.db.WithContext(ctx).First(&m, "user_id = ?", userID).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *EmailVerificationRepository) DeleteByUserID(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&EmailVerificationModel{}, "user_id = ?", userID).Error
}

func (r *EmailVerificationRepository) Consume(ctx context.Context, tokenHash string) (*domain.EmailVerification, error) {
	var ms []EmailVerificationModel
	err := r.db.WithContext(ctx).Clauses(clause.Returning{}).Where("token_hash = ?", tokenHash).Delete(&ms).Error
	if err != nil {
		return nil, err
	}
	if len(ms) == 0 {
		return nil, domain.ErrNotFound
	}
	return ms[0].toDomain(), nil
}

func (r *EmailVerificationRepository) DeleteExpired(ctx context.Context, now time.Time) error {
	return r.db.WithContext(ctx).Delete(&EmailVerificationModel{}, "expires_at <= ?", now).Error
}
