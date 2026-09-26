package hike

import (
	"context"
	"log/slog"
	"math"
	"slices"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// DerivedVersion is bumped whenever derive computes something new, so stored
// hikes get recomputed by RefreshDerived.
const DerivedVersion = 3

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
	d.Tiles = tiles(samples)
	if s.MovingS != nil {
		v := int64(math.Round(*s.MovingS))
		d.MovingS = &v
	}
	return d
}

// EffortDistances are the distances, in meters, best efforts are kept for.
var EffortDistances = []int{1000, 5000, 10000, 21097, 42195}

// bestEfforts finds, for each of EffortDistances the track covers, the
// shortest time to cover that distance along it. Each window ends on a fix and
// starts exactly dist before it, interpolated between fixes at constant speed,
// so sparse recordings don't stretch a 1 km effort to the gap between fixes.
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
			start := *timed[i].ElapsedS
			if a, b := timed[i], timed[i+1]; b.DistM > a.DistM {
				along := (timed[j].DistM - dist - a.DistM) / (b.DistM - a.DistM)
				start += along * (*b.ElapsedS - *a.ElapsedS)
			}
			if dt := *timed[j].ElapsedS - start; dt > 0 && dt < best {
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

// tileStepM is how far apart points are checked along a track; well under a
// tile's width so no crossed tile is missed.
const tileStepM = 100

// tiles returns the distinct TileZoom tiles a track passes through, sorted.
func tiles(samples []domain.Sample) []domain.Tile {
	seen := map[domain.Tile]bool{}
	for i, s := range samples {
		seen[tileAt(s.Lon, s.Lat)] = true
		if i == 0 || samples[i-1].Segment != s.Segment {
			continue
		}
		a := samples[i-1]
		// Fill in long straight stretches between fixes.
		n := int(haversine(a.Lat, a.Lon, s.Lat, s.Lon) / tileStepM)
		for k := 1; k <= n; k++ {
			t := float64(k) / float64(n+1)
			seen[tileAt(a.Lon+(s.Lon-a.Lon)*t, a.Lat+(s.Lat-a.Lat)*t)] = true
		}
	}
	out := make([]domain.Tile, 0, len(seen))
	for t := range seen {
		out = append(out, t)
	}
	slices.SortFunc(out, func(a, b domain.Tile) int {
		if a.X != b.X {
			return a.X - b.X
		}
		return a.Y - b.Y
	})
	return out
}

// tileAt is the web mercator tile containing a WGS84 position.
func tileAt(lon, lat float64) domain.Tile {
	n := math.Exp2(domain.TileZoom)
	lat = max(-85.0511, min(85.0511, lat))
	r := lat * math.Pi / 180
	x := int(math.Floor((lon + 180) / 360 * n))
	y := int(math.Floor((1 - math.Log(math.Tan(r)+1/math.Cos(r))/math.Pi) / 2 * n))
	last := int(n) - 1
	return domain.Tile{X: max(0, min(last, x)), Y: max(0, min(last, y))}
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
