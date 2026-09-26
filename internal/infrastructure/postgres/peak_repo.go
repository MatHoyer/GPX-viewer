package postgres

import (
	"context"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type PeakRepository struct {
	db *gorm.DB
}

func NewPeakRepository(db *gorm.DB) *PeakRepository { return &PeakRepository{db: db} }

const upsertBatch = 500

func (r *PeakRepository) Upsert(ctx context.Context, peaks []domain.Peak) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for start := 0; start < len(peaks); start += upsertBatch {
			for _, p := range peaks[start:min(start+upsertBatch, len(peaks))] {
				err := tx.Exec(`
INSERT INTO peaks (id, name, ele_m, geom) VALUES (?, ?, ?, ST_SetSRID(ST_MakePoint(?, ?), 4326))
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, ele_m = EXCLUDED.ele_m, geom = EXCLUDED.geom`,
					p.ID, p.Name, p.EleM, p.Lon, p.Lat).Error
				if err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// nearTrack matches peaks within @radius meters of a hike's track: a cheap
// bounding box test on the peaks index first (0.01° is over 700 m at any
// latitude hikes happen), then the exact distance on the sphere.
const nearTrack = `p.geom && ST_Expand(h.geom, 0.01)
  AND ST_DWithin(p.geom::geography, ST_Force2D(h.geom)::geography, @radius)`

type peakRow struct {
	ID   int64
	Name string
	EleM *float64
	Lon  float64
	Lat  float64
}

func (row peakRow) toDomain() domain.Peak {
	return domain.Peak{ID: row.ID, Name: row.Name, EleM: row.EleM, Lon: row.Lon, Lat: row.Lat}
}

func (r *PeakRepository) OnHike(ctx context.Context, hikeID uuid.UUID, radiusM float64) ([]domain.Peak, error) {
	var rows []peakRow
	err := r.db.WithContext(ctx).Raw(`
SELECT p.id, p.name, p.ele_m, ST_X(p.geom) AS lon, ST_Y(p.geom) AS lat
FROM peaks p JOIN hikes h ON h.id = @hike
WHERE `+nearTrack+`
ORDER BY p.ele_m DESC NULLS LAST, p.name`,
		map[string]any{"hike": hikeID, "radius": radiusM}).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]domain.Peak, len(rows))
	for i, row := range rows {
		out[i] = row.toDomain()
	}
	return out, nil
}

func (r *PeakRepository) OfUser(ctx context.Context, userID uuid.UUID, radiusM float64) ([]domain.Summit, error) {
	var rows []struct {
		ID        int64
		Name      string
		EleM      *float64
		Lon       float64
		Lat       float64
		HikeID    uuid.UUID
		StartedAt *time.Time
	}
	err := r.db.WithContext(ctx).Raw(`
SELECT p.id, p.name, p.ele_m, ST_X(p.geom) AS lon, ST_Y(p.geom) AS lat, h.id AS hike_id, h.started_at
FROM hikes h JOIN peaks p ON `+nearTrack+`
WHERE h.user_id = @user OR h.id IN (SELECT hike_id FROM hike_participants WHERE user_id = @user)
ORDER BY p.ele_m DESC NULLS LAST, p.name, p.id, h.started_at DESC NULLS LAST`,
		map[string]any{"user": userID, "radius": radiusM}).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	var out []domain.Summit
	for _, row := range rows {
		if len(out) == 0 || out[len(out)-1].Peak.ID != row.ID {
			peak := peakRow{ID: row.ID, Name: row.Name, EleM: row.EleM, Lon: row.Lon, Lat: row.Lat}
			out = append(out, domain.Summit{Peak: peak.toDomain()})
		}
		last := &out[len(out)-1]
		last.Visits = append(last.Visits, domain.SummitVisit{HikeID: row.HikeID, StartedAt: row.StartedAt})
	}
	return out, nil
}
