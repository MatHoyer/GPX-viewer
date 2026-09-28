package postgres

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository { return &UserRepository{db: db} }

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	m := UserModel{
		ID:              u.ID,
		Email:           u.Email,
		Name:            u.Name,
		PasswordHash:    u.PasswordHash,
		Visibility:      string(u.Visibility),
		EmailVerifiedAt: u.EmailVerifiedAt,
		IsAdmin:         u.IsAdmin,
		BannedAt:        u.BannedAt,
		BanReason:       u.BanReason,
		InvitedAt:       u.InvitedAt,
		CreatedAt:       u.CreatedAt,
	}
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

func (r *UserRepository) MarkEmailVerified(ctx context.Context, id uuid.UUID, at time.Time) error {
	res := r.db.WithContext(ctx).Model(&UserModel{}).Where("id = ?", id).Update("email_verified_at", at)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	res := r.db.WithContext(ctx).Model(&UserModel{}).Where("id = ?", id).Update("password_hash", hash)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *UserRepository) Delete(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Delete(&UserModel{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
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

func (r *UserRepository) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&UserModel{}).Count(&n).Error
	return n, err
}

func (r *UserRepository) CountAdmins(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.WithContext(ctx).Model(&UserModel{}).Where("is_admin").Count(&n).Error
	return n, err
}

type adminUserRow struct {
	UserModel
	Hikes      int64
	LastSeenAt *time.Time
}

// adminUsers selects users with their hike count and last activity.
func (r *UserRepository) adminUsers(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).Table("users AS u").Select(`u.*,
		(SELECT COUNT(*) FROM hikes h WHERE h.user_id = u.id) AS hikes,
		(SELECT MAX(COALESCE(s.last_used_at, s.created_at)) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at`)
}

func (row *adminUserRow) toDomain() domain.AdminUser {
	return domain.AdminUser{User: *row.UserModel.toDomain(), Hikes: row.Hikes, LastSeenAt: row.LastSeenAt}
}

func (r *UserRepository) ListUsers(ctx context.Context, query string, limit, offset int) ([]domain.AdminUser, int64, error) {
	match := func(db *gorm.DB) *gorm.DB {
		if query == "" {
			return db
		}
		pattern := "%" + likeEscaper.Replace(query) + "%"
		return db.Where("u.email ILIKE ? OR u.name ILIKE ?", pattern, pattern)
	}
	var total int64
	if err := match(r.db.WithContext(ctx).Table("users AS u")).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []adminUserRow
	err := match(r.adminUsers(ctx)).Order("u.created_at, u.id").Limit(limit).Offset(offset).Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	out := make([]domain.AdminUser, len(rows))
	for i := range rows {
		out[i] = rows[i].toDomain()
	}
	return out, total, nil
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func (r *UserRepository) GetAdminUser(ctx context.Context, id uuid.UUID) (*domain.AdminUser, error) {
	var rows []adminUserRow
	if err := r.adminUsers(ctx).Where("u.id = ?", id).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, domain.ErrNotFound
	}
	u := rows[0].toDomain()
	return &u, nil
}

func (r *UserRepository) SetAdmin(ctx context.Context, id uuid.UUID, admin bool) error {
	return r.update(ctx, id, map[string]any{"is_admin": admin})
}

func (r *UserRepository) SetBan(ctx context.Context, id uuid.UUID, at *time.Time, reason string) error {
	return r.update(ctx, id, map[string]any{"banned_at": at, "ban_reason": reason})
}

func (r *UserRepository) AcceptInvite(ctx context.Context, id uuid.UUID) error {
	return r.update(ctx, id, map[string]any{"invited_at": nil})
}

func (r *UserRepository) SetEmailVerified(ctx context.Context, id uuid.UUID, at *time.Time) error {
	return r.update(ctx, id, map[string]any{"email_verified_at": at})
}

func (r *UserRepository) DeletePending(ctx context.Context, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Exec(`DELETE FROM users u
		WHERE u.id = ? AND u.invited_at IS NOT NULL
		AND NOT EXISTS (SELECT 1 FROM hikes h WHERE h.user_id = u.id)`, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		if _, err := r.GetByID(ctx, id); err != nil {
			return err
		}
		return domain.ErrConflict
	}
	return nil
}

func (r *UserRepository) update(ctx context.Context, id uuid.UUID, fields map[string]any) error {
	res := r.db.WithContext(ctx).Model(&UserModel{}).Where("id = ?", id).Updates(fields)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func mapErr(err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ErrNotFound
	}
	return err
}
