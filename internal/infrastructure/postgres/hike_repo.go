package postgres

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type HikeRepository struct {
	db *gorm.DB
}

func NewHikeRepository(db *gorm.DB) *HikeRepository { return &HikeRepository{db: db} }

const hikeOrder = "started_at DESC NULLS LAST, created_at DESC"

func (r *HikeRepository) Create(ctx context.Context, h *domain.Hike) error {
	g, err := segmentsToGeom(h.Segments)
	if err != nil {
		return err
	}
	m := HikeModel{
		ID:             h.ID,
		UserID:         h.UserID,
		Name:           h.Name,
		DistanceM:      h.DistanceM,
		ElevationGainM: h.ElevationGainM,
		StartedAt:      h.StartedAt,
		DurationS:      h.DurationS,
		MinLon:         h.Bounds.MinLon,
		MinLat:         h.Bounds.MinLat,
		MaxLon:         h.Bounds.MaxLon,
		MaxLat:         h.Bounds.MaxLat,
		Geom:           g,
		GPXRaw:         h.RawGPX,
		CreatedAt:      h.CreatedAt,
	}
	return r.db.WithContext(ctx).Omit(clause.Associations).Create(&m).Error
}

func (r *HikeRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Hike, error) {
	var ms []HikeModel
	err := r.db.WithContext(ctx).
		Omit("geom", "gpx_raw").
		Where("user_id = ?", userID).
		Order(hikeOrder).
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Hike, len(ms))
	for i, m := range ms {
		out[i] = m.toDomain()
	}
	return out, nil
}

func (r *HikeRepository) GetByID(ctx context.Context, userID, id uuid.UUID) (*domain.Hike, error) {
	var m HikeModel
	err := r.db.WithContext(ctx).
		Omit("geom", "gpx_raw").
		Where("user_id = ? AND id = ?", userID, id).
		First(&m).Error
	if err != nil {
		return nil, mapErr(err)
	}
	h := m.toDomain()
	return &h, nil
}

func (r *HikeRepository) GetRawGPX(ctx context.Context, userID, id uuid.UUID) ([]byte, error) {
	var m HikeModel
	err := r.db.WithContext(ctx).
		Select("gpx_raw").
		Where("user_id = ? AND id = ?", userID, id).
		First(&m).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return m.GPXRaw, nil
}

func (r *HikeRepository) Rename(ctx context.Context, userID, id uuid.UUID, name string) error {
	res := r.db.WithContext(ctx).
		Model(&HikeModel{}).
		Where("user_id = ? AND id = ?", userID, id).
		Update("name", name)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *HikeRepository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	res := r.db.WithContext(ctx).Where("user_id = ? AND id = ?", userID, id).Delete(&HikeModel{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *HikeRepository) ListTracks(ctx context.Context, userID uuid.UUID, tolerance float64) ([]domain.HikeTrack, error) {
	var rows []struct {
		ID   uuid.UUID
		Name string
		Geom []byte
	}
	err := r.db.WithContext(ctx).
		Model(&HikeModel{}).
		Select("id, name, ST_AsBinary(ST_Force2D(ST_SimplifyPreserveTopology(geom, ?))) AS geom", tolerance).
		Where("user_id = ?", userID).
		Order(hikeOrder).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.HikeTrack, 0, len(rows))
	for _, row := range rows {
		segs, err := wkbToSegments(row.Geom)
		if err != nil {
			return nil, fmt.Errorf("decode hike %s geometry: %w", row.ID, err)
		}
		out = append(out, domain.HikeTrack{ID: row.ID, Name: row.Name, Segments: segs})
	}
	return out, nil
}
