package hike

import (
	"context"
	"log/slog"
	"math"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// DerivedVersion is bumped whenever derive computes something new, so stored
// hikes get recomputed by RefreshDerived.
const DerivedVersion = 1

const refreshBatchSize = 20

// derive computes the statistics stored alongside a hike from its parsed track
// and raw samples.
func derive(parsed *domain.ParsedTrack, samples []domain.Sample) domain.HikeDerived {
	d := domain.HikeDerived{ElevationLossM: parsed.ElevationLossM}
	if len(samples) == 0 {
		return d
	}
	s := BuildProfile(samples, 0).Summary
	d.MinEleM, d.MaxEleM = s.MinEle, s.MaxEle
	if s.MovingS != nil {
		v := int64(math.Round(*s.MovingS))
		d.MovingS = &v
	}
	return d
}

// deriveRaw parses a stored GPX file and derives its statistics.
func (s *Service) deriveRaw(raw []byte) (domain.HikeDerived, error) {
	parsed, err := s.parser.Parse(raw)
	if err != nil {
		return domain.HikeDerived{}, err
	}
	samples, err := s.parser.Samples(raw)
	if err != nil {
		return domain.HikeDerived{}, err
	}
	return derive(parsed, samples), nil
}

// RefreshDerived recomputes the derived data of every hike stored by an older
// version and returns how many were updated. A hike whose GPX no longer parses
// is still marked current so it is not retried forever.
func (s *Service) RefreshDerived(ctx context.Context) (int, error) {
	n := 0
	for {
		batch, err := s.hikes.ListOutdated(ctx, DerivedVersion, refreshBatchSize)
		if err != nil {
			return n, err
		}
		if len(batch) == 0 {
			return n, nil
		}
		for _, h := range batch {
			d, err := s.deriveRaw(h.RawGPX)
			if err != nil {
				slog.Warn("derive hike stats", "hike", h.ID, "err", err)
			}
			if err := s.hikes.SaveDerived(ctx, h.ID, d, DerivedVersion); err != nil {
				return n, err
			}
			n++
		}
	}
}
