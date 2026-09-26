package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

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

// withOwner loads each hike's owner, minus their credentials.
func withOwner(db *gorm.DB) *gorm.DB {
	return db.Preload("User", func(db *gorm.DB) *gorm.DB {
		return db.Select("id, email, name, visibility, created_at")
	})
}

// withLabels loads each hike's labels in alphabetical order.
func withLabels(db *gorm.DB) *gorm.DB {
	return db.Preload("Labels", func(db *gorm.DB) *gorm.DB { return db.Order("label") })
}

// ownedOrTagged matches the hikes of a user, including those they are tagged on.
const ownedOrTagged = "user_id = ? OR id IN (SELECT hike_id FROM hike_participants WHERE user_id = ?)"

func (r *HikeRepository) Create(ctx context.Context, h *domain.Hike) error {
	g, err := segmentsToGeom(h.Segments)
	if err != nil {
		return err
	}
	m := HikeModel{
		ID:             h.ID,
		UserID:         h.UserID,
		Name:           h.Name,
		Notes:          h.Notes,
		DistanceM:      h.DistanceM,
		ElevationGainM: h.ElevationGainM,
		StartedAt:      h.StartedAt,
		DurationS:      h.DurationS,
		ElevationLossM: h.ElevationLossM,
		MinEleM:        h.MinEleM,
		MaxEleM:        h.MaxEleM,
		MovingS:        h.MovingS,
		DerivedVersion: h.DerivedVersion,
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
		Scopes(withOwner, withLabels).
		Omit("geom", "gpx_raw").
		Where(ownedOrTagged, userID, userID).
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
		Scopes(withLabels).
		Omit("geom", "gpx_raw").
		Where("user_id = ? AND id = ?", userID, id).
		First(&m).Error
	if err != nil {
		return nil, mapErr(err)
	}
	h := m.toDomain()
	return &h, nil
}

func (r *HikeRepository) Find(ctx context.Context, id uuid.UUID) (*domain.Hike, error) {
	var m HikeModel
	if err := r.db.WithContext(ctx).Scopes(withOwner, withLabels).Omit("geom", "gpx_raw").Where("id = ?", id).First(&m).Error; err != nil {
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

func (r *HikeRepository) Update(ctx context.Context, userID, id uuid.UUID, u domain.HikeUpdate) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var n int64
		if err := tx.Model(&HikeModel{}).Where("user_id = ? AND id = ?", userID, id).Count(&n).Error; err != nil {
			return err
		}
		if n == 0 {
			return domain.ErrNotFound
		}
		cols := map[string]any{}
		if u.Name != nil {
			cols["name"] = *u.Name
		}
		if u.Notes != nil {
			cols["notes"] = *u.Notes
		}
		if len(cols) > 0 {
			if err := tx.Model(&HikeModel{}).Where("id = ?", id).Updates(cols).Error; err != nil {
				return err
			}
		}
		if u.Labels == nil {
			return nil
		}
		if err := tx.Where("hike_id = ?", id).Delete(&HikeLabelModel{}).Error; err != nil {
			return err
		}
		if len(*u.Labels) == 0 {
			return nil
		}
		ms := make([]HikeLabelModel, len(*u.Labels))
		for i, l := range *u.Labels {
			ms[i] = HikeLabelModel{HikeID: id, Label: l}
		}
		return tx.Omit(clause.Associations).Create(&ms).Error
	})
}

func (r *HikeRepository) ListLabels(ctx context.Context, userID uuid.UUID) ([]string, error) {
	var labels []string
	err := r.db.WithContext(ctx).
		Model(&HikeLabelModel{}).
		Joins("JOIN hikes h ON h.id = hike_labels.hike_id").
		Where("h.user_id = ?", userID).
		Group("label").
		Order("COUNT(*) DESC, label").
		Pluck("label", &labels).Error
	return labels, err
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
		Where(ownedOrTagged, userID, userID).
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

func (r *HikeRepository) ListParticipants(ctx context.Context, hikeID uuid.UUID) ([]domain.User, error) {
	var ms []UserModel
	err := r.db.WithContext(ctx).
		Select("users.id, users.email, users.name, users.visibility, users.created_at").
		Joins("JOIN hike_participants p ON p.user_id = users.id").
		Where("p.hike_id = ?", hikeID).
		Order("p.created_at").
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

func (r *HikeRepository) AddParticipant(ctx context.Context, hikeID, userID uuid.UUID, at time.Time) error {
	m := HikeParticipantModel{HikeID: hikeID, UserID: userID, CreatedAt: at}
	err := r.db.WithContext(ctx).Omit(clause.Associations).Clauses(clause.OnConflict{DoNothing: true}).Create(&m).Error
	if errors.Is(err, gorm.ErrForeignKeyViolated) {
		return domain.ErrNotFound
	}
	return err
}

func (r *HikeRepository) RemoveParticipant(ctx context.Context, hikeID, userID uuid.UUID) error {
	return r.db.WithContext(ctx).Where("hike_id = ? AND user_id = ?", hikeID, userID).Delete(&HikeParticipantModel{}).Error
}

func (r *HikeRepository) ListOutdated(ctx context.Context, version, limit int) ([]domain.Hike, error) {
	var ms []HikeModel
	err := r.db.WithContext(ctx).
		Select("id, gpx_raw").
		Where("derived_version < ?", version).
		Order("id").
		Limit(limit).
		Find(&ms).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Hike, len(ms))
	for i, m := range ms {
		out[i] = domain.Hike{ID: m.ID, RawGPX: m.GPXRaw}
	}
	return out, nil
}

func (r *HikeRepository) SaveDerived(ctx context.Context, id uuid.UUID, d domain.HikeDerived, version int) error {
	return r.db.WithContext(ctx).
		Model(&HikeModel{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"elevation_loss_m": d.ElevationLossM,
			"min_ele_m":        d.MinEleM,
			"max_ele_m":        d.MaxEleM,
			"moving_s":         d.MovingS,
			"derived_version":  version,
		}).Error
}
