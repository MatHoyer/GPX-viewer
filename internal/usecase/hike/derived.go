package hike

import (
	"context"
	"log/slog"
	"math"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// DerivedVersion is bumped whenever derive computes something new, so stored
// hikes get recomputed by RefreshDerived.
const DerivedVersion = 2

const refreshBatchSize = 20

// derive computes the statistics stored alongside a hike from its parsed track
// and raw samples.
func derive(parsed *domain.ParsedTrack, samples []domain.Sample) domain.HikeDerived {
	d := domain.HikeDerived{ElevationLossM: parsed.ElevationLossM}
	if len(samples) == 0 {
		return d
	}
	p := BuildProfile(samples, 0)
	s := p.Summary
	d.MinEleM, d.MaxEleM = s.MinEle, s.MaxEle
	d.BestEfforts = bestEfforts(p.Points)
	if s.MovingS != nil {
		v := int64(math.Round(*s.MovingS))
		d.MovingS = &v
	}
	return d
}

// EffortDistances are the distances, in meters, best efforts are kept for.
var EffortDistances = []int{1000, 5000, 10000, 21097, 42195}

// bestEfforts finds, for each of EffortDistances the track covers, the
// shortest time between two fixes that far apart along it.
func bestEfforts(pts []domain.ProfilePoint) []domain.BestEffort {
	var timed []domain.ProfilePoint
	for _, p := range pts {
		if p.ElapsedS != nil {
			timed = append(timed, p)
		}
	}
	var out []domain.BestEffort
	for _, d := range EffortDistances {
		dist := float64(d)
		best := math.Inf(1)
		i := 0
		for j := range timed {
			// Keep the latest start that still leaves at least dist before j.
			for i+1 < j && timed[j].DistM-timed[i+1].DistM >= dist {
				i++
			}
			if timed[j].DistM-timed[i].DistM < dist {
				continue
			}
			if dt := *timed[j].ElapsedS - *timed[i].ElapsedS; dt > 0 && dt < best {
				best = dt
			}
		}
		// GPS jumps can fake impossible efforts; ignore those.
		if math.IsInf(best, 1) || dist/best > maxPlausibleSpeed {
			break
		}
		out = append(out, domain.BestEffort{DistanceM: d, DurationS: int(math.Round(best))})
	}
	return out
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
