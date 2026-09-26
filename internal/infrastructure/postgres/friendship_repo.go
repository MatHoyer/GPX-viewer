package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type FriendshipRepository struct {
	db *gorm.DB
}

func NewFriendshipRepository(db *gorm.DB) *FriendshipRepository { return &FriendshipRepository{db: db} }

const pairClause = "(requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)"

func (r *FriendshipRepository) Get(ctx context.Context, a, b uuid.UUID) (*domain.Friendship, error) {
	var m FriendshipModel
	if err := r.db.WithContext(ctx).Where(pairClause, a, b, b, a).First(&m).Error; err != nil {
		return nil, mapErr(err)
	}
	return m.toDomain(), nil
}

func (r *FriendshipRepository) Create(ctx context.Context, f *domain.Friendship) error {
	m := FriendshipModel{RequesterID: f.RequesterID, AddresseeID: f.AddresseeID, CreatedAt: f.CreatedAt}
	err := r.db.WithContext(ctx).Omit(clause.Associations).Create(&m).Error
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return domain.ErrConflict
	}
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		return domain.ErrNotFound
	}
	return err
}

func (r *FriendshipRepository) Accept(ctx context.Context, requesterID, addresseeID uuid.UUID, at time.Time) error {
	res := r.db.WithContext(ctx).
		Model(&FriendshipModel{}).
		Where("requester_id = ? AND addressee_id = ? AND accepted_at IS NULL", requesterID, addresseeID).
		Update("accepted_at", at)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *FriendshipRepository) Delete(ctx context.Context, a, b uuid.UUID) error {
	return r.db.WithContext(ctx).Where(pairClause, a, b, b, a).Delete(&FriendshipModel{}).Error
}

func (r *FriendshipRepository) ListConnections(ctx context.Context, userID uuid.UUID) ([]domain.Connection, error) {
	var rows []struct {
		UserModel   `gorm:"embedded"`
		RequesterID uuid.UUID
		AcceptedAt  *time.Time
		Since       time.Time
	}
	err := r.db.WithContext(ctx).
		Table("friendships f").
		Select("u.id, u.email, u.name, u.visibility, u.avatar_updated_at, u.created_at, "+
			"f.requester_id, f.accepted_at, COALESCE(f.accepted_at, f.created_at) AS since").
		Joins("JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END", userID).
		Where("f.requester_id = ? OR f.addressee_id = ?", userID, userID).
		Order("since DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Connection, len(rows))
	for i, row := range rows {
		f := domain.Friendship{RequesterID: row.RequesterID, Accepted: row.AcceptedAt != nil}
		out[i] = domain.Connection{User: *row.UserModel.toDomain(), Relation: f.RelationFor(userID), Since: row.Since}
	}
	return out, nil
}
