package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// WeatherRepository stores weather on the hikes table.
type WeatherRepository struct {
	db *gorm.DB
}

func NewWeatherRepository(db *gorm.DB) *WeatherRepository {
	return &WeatherRepository{db: db}
}

func (r *WeatherRepository) ListMissing(ctx context.Context, endedBefore time.Time, limit int) ([]domain.Hike, error) {
	var ms []HikeModel
	err := r.db.WithContext(ctx).
		Select("id, gpx_raw").
		Where("NOT planned AND weather_at IS NULL AND started_at IS NOT NULL").
		Where("started_at + duration_s * interval '1 second' < ?", endedBefore).
		Order("started_at DESC").
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

func (r *WeatherRepository) Save(ctx context.Context, hikeID uuid.UUID, hours []domain.WeatherHour) error {
	b, err := json.Marshal(hours)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Model(&HikeModel{}).Where("id = ?", hikeID).
		Updates(map[string]any{"weather": string(b), "weather_at": time.Now()}).Error
}
