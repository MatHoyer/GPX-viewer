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

type InteractionRepository struct {
	db *gorm.DB
}

func NewInteractionRepository(db *gorm.DB) *InteractionRepository {
	return &InteractionRepository{db: db}
}

func (r *InteractionRepository) Counts(ctx context.Context, viewer uuid.UUID, hikeIDs []uuid.UUID) (map[uuid.UUID]domain.HikeInteractions, error) {
	out := make(map[uuid.UUID]domain.HikeInteractions, len(hikeIDs))
	if len(hikeIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		ID       uuid.UUID
		Kudos    int
		Comments int
		Kudoed   bool
	}
	err := r.db.WithContext(ctx).Raw(`
SELECT h.id,
  (SELECT COUNT(*) FROM hike_kudos k WHERE k.hike_id = h.id) AS kudos,
  (SELECT COUNT(*) FROM hike_comments c WHERE c.hike_id = h.id) AS comments,
  EXISTS (SELECT 1 FROM hike_kudos k WHERE k.hike_id = h.id AND k.user_id = @viewer) AS kudoed
FROM hikes h WHERE h.id IN @ids`, map[string]any{"viewer": viewer, "ids": hikeIDs}).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[row.ID] = domain.HikeInteractions{Kudos: row.Kudos, Comments: row.Comments, Kudoed: row.Kudoed}
	}
	return out, nil
}

func (r *InteractionRepository) AddKudos(ctx context.Context, hikeID, userID uuid.UUID, at time.Time) error {
	m := HikeKudosModel{HikeID: hikeID, UserID: userID, CreatedAt: at}
	err := r.db.WithContext(ctx).Omit(clause.Associations).Clauses(clause.OnConflict{DoNothing: true}).Create(&m).Error
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		return domain.ErrNotFound
	}
	return err
}

func (r *InteractionRepository) RemoveKudos(ctx context.Context, hikeID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("hike_id = ? AND user_id = ?", hikeID, userID).Delete(&HikeKudosModel{}).Error
}

func (r *InteractionRepository) ListComments(ctx context.Context, hikeID uuid.UUID) ([]domain.Comment, error) {
	var ms []HikeCommentModel
	err := r.db.WithContext(ctx).
		Scopes(withOwner).
		Where("hike_id = ?", hikeID).
		Order("created_at, id").
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Comment, len(ms))
	for i, m := range ms {
		out[i] = m.toDomain()
	}
	return out, nil
}

func (r *InteractionRepository) CreateComment(ctx context.Context, c *domain.Comment) error {
	m := HikeCommentModel{ID: c.ID, HikeID: c.HikeID, UserID: c.UserID, Body: c.Body, CreatedAt: c.CreatedAt}
	err := r.db.WithContext(ctx).Omit(clause.Associations).Create(&m).Error
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		return domain.ErrNotFound
	}
	return err
}

func (r *InteractionRepository) GetComment(ctx context.Context, hikeID, id uuid.UUID) (*domain.Comment, error) {
	var m HikeCommentModel
	if err := r.db.WithContext(ctx).Where("hike_id = ? AND id = ?", hikeID, id).First(&m).Error; err != nil {
		return nil, mapErr(err)
	}
	c := m.toDomain()
	return &c, nil
}

func (r *InteractionRepository) DeleteComment(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(&HikeCommentModel{}).Error
}
