package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository { return &UserRepository{db: db} }

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	m := UserModel{ID: u.ID, Email: u.Email, Name: u.Name, PasswordHash: u.PasswordHash, Visibility: string(u.Visibility), CreatedAt: u.CreatedAt}
	err := r.db.WithContext(ctx).Create(&m).Error
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return domain.ErrEmailTaken
	}
	return err
}

func (r *UserRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var m UserModel
	if err := r.db.WithContext(ctx).First(&m, "id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var m UserModel
	if err := r.db.WithContext(ctx).First(&m, "email = ?", email).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *UserRepository) UpdateName(ctx context.Context, id uuid.UUID, name string) error {
	res := r.db.WithContext(ctx).Model(&UserModel{}).Where("id = ?", id).Update("name", name)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepository) UpdateVisibility(ctx context.Context, id uuid.UUID, v domain.Visibility) error {
	res := r.db.WithContext(ctx).Model(&UserModel{}).Where("id = ?", id).Update("visibility", string(v))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// Search matches an exact email, or a name fragment among users who are not
// private: a private user can only be found by someone who knows their email.
func (r *UserRepository) Search(ctx context.Context, query string, exclude uuid.UUID, limit int) ([]domain.User, error) {
	var ms []UserModel
	err := r.db.WithContext(ctx).
		Where("id <> ?", exclude).
		Where("email = ? OR (visibility <> ? AND name ILIKE ?)",
			strings.ToLower(query), string(domain.VisibilityPrivate), "%"+likeEscaper.Replace(query)+"%").
		Order("name, created_at").
		Limit(limit).
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.User, len(ms))
	for i, m := range ms {
		out[i] = *m.toDomain()
	}
	return out, nil
}

func (r *UserRepository) SetAvatar(ctx context.Context, id uuid.UUID, a *domain.Avatar) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&UserModel{}).Where("id = ?", id).Update("avatar_updated_at", a.UpdatedAt)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return domain.ErrNotFound
		}
		m := UserAvatarModel{UserID: id, ContentType: a.ContentType, Data: a.Data, UpdatedAt: a.UpdatedAt}
		return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&m).Error
	})
}

func (r *UserRepository) DeleteAvatar(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&UserAvatarModel{}, "user_id = ?", id).Error; err != nil {
			return err
		}
		return tx.Model(&UserModel{}).Where("id = ?", id).Update("avatar_updated_at", nil).Error
	})
}

func (r *UserRepository) GetAvatar(ctx context.Context, id uuid.UUID) (*domain.Avatar, error) {
	var m UserAvatarModel
	if err := r.db.WithContext(ctx).First(&m, "user_id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &domain.Avatar{ContentType: m.ContentType, Data: m.Data, UpdatedAt: m.UpdatedAt}, nil
}

func mapErr(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ErrNotFound
	}
	return err
}
