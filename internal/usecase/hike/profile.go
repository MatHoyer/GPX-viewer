package hike

import (
	"math"
	"sort"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const (
	// ProfileMaxPoints bounds the size of the series sent to clients.
	ProfileMaxPoints = 2000

	speedWindowS      = 15.0 // half window for speed smoothing
	maxPlausibleSpeed = 15.0 // m/s (~54 km/h); faster readings are GPS noise
	movingThresholdMS = 0.3  // below this pace the hiker is considered stopped
	eleSmoothRadius   = 2    // points on each side for elevation smoothing
	earthRadiusM      = 6371008.8
)

// BuildProfile derives distance, elapsed time, speed and summary statistics
// from raw samples. The summary uses full resolution; the returned points are
// downsampled to at most about maxPoints.
func BuildProfile(samples []domain.Sample, maxPoints int) *domain.Profile {
	p := &domain.Profile{Points: make([]domain.ProfilePoint, len(samples))}
	if len(samples) == 0 {
		return p
	}
	pts := p.Points

	computeDistances(samples, pts)
	p.Has.Time = computeElapsed(samples, pts)
	if p.Has.Time {
		computeSpeeds(pts)
	}
	for _, s := range samples {
		p.Has.Ele = p.Has.Ele || s.Ele != nil
		p.Has.HR = p.Has.HR || s.HR != nil
		p.Has.Cad = p.Has.Cad || s.Cad != nil
		p.Has.Temp = p.Has.Temp || s.Temp != nil
	}

	p.Summary = summarize(pts)
	p.Points = downsample(pts, maxPoints)
	return p
}

func computeDistances(samples []domain.Sample, pts []domain.ProfilePoint) {
	dist := 0.0
	for i, s := range samples {
		// Gaps between segments are not walked distance.
		if i > 0 && s.Segment == samples[i-1].Segment {
			dist += haversine(samples[i-1].Lat, samples[i-1].Lon, s.Lat, s.Lon)
		}
		pts[i] = domain.ProfilePoint{Sample: s, DistM: dist}
	}
}

// computeElapsed fills ElapsedS relative to the first timestamp and reports
// whether the track is usable as a time series.
func computeElapsed(samples []domain.Sample, pts []domain.ProfilePoint) bool {
	var t0 *float64
	timed := 0
	for i, s := range samples {
		if s.Time == nil {
			continue
		}
		unix := float64(s.Time.UnixMilli()) / 1000
		if t0 == nil {
			t0 = &unix
		}
		e := unix - *t0
		if e < 0 {
			continue
		}
		pts[i].ElapsedS = &e
		timed++
	}
	return timed >= 2 && timed*10 >= len(samples)*9
}

// computeSpeeds sets a speed averaged over a ±speedWindowS time window.
func computeSpeeds(pts []domain.ProfilePoint) {
	timed := make([]int, 0, len(pts))
	for i := range pts {
		if pts[i].ElapsedS != nil {
			timed = append(timed, i)
		}
	}
	lo, hi := 0, 0
	for k, i := range timed {
		t := *pts[i].ElapsedS
		for lo < k && *pts[timed[lo]].ElapsedS < t-speedWindowS {
			lo++
		}
		if hi < k {
			hi = k
		}
		for hi+1 < len(timed) && *pts[timed[hi+1]].ElapsedS <= t+speedWindowS {
			hi++
		}
		// Sparse recordings (a fix every 15 s or more) leave the window empty,
		// so always reach at least the adjacent points.
		a, b := pts[timed[min(lo, max(0, k-1))]], pts[timed[max(hi, min(len(timed)-1, k+1))]]
		dt := *b.ElapsedS - *a.ElapsedS
		if dt <= 0 {
			continue
		}
		v := (b.DistM - a.DistM) / dt
		if v <= maxPlausibleSpeed {
			pts[i].SpeedMS = &v
		}
	}
}

func summarize(pts []domain.ProfilePoint) domain.ProfileSummary {
	var s domain.ProfileSummary
	s.DistanceM = pts[len(pts)-1].DistM

	gain, loss, minEle, maxEle, hasEle := elevationStats(pts)
	if hasEle {
		s.ElevationGainM, s.ElevationLossM = gain, loss
		s.MinEle, s.MaxEle = &minEle, &maxEle
	}

	var moving, movingDist, elapsed float64
	var hasTime bool
	var maxSpeed *float64
	for i := range pts {
		if e := pts[i].ElapsedS; e != nil {
			hasTime = true
			elapsed = max(elapsed, *e)
		}
		if v := pts[i].SpeedMS; v != nil && (maxSpeed == nil || *v > *maxSpeed) {
			maxSpeed = ptr(*v)
		}
		if i == 0 {
			continue
		}
		a, b := pts[i-1], pts[i]
		if a.ElapsedS == nil || b.ElapsedS == nil || a.Segment != b.Segment {
			continue
		}
		dt, dd := *b.ElapsedS-*a.ElapsedS, b.DistM-a.DistM
		if dt > 0 && dd/dt >= movingThresholdMS && dd/dt <= maxPlausibleSpeed {
			moving += dt
			movingDist += dd
		}
	}
	if hasTime {
		s.ElapsedS = &elapsed
		s.MovingS = &moving
		s.MaxSpeedMS = maxSpeed
		if moving > 0 {
			s.AvgSpeedMS = ptr(movingDist / moving)
		}
	}

	s.AvgHR, s.MaxHR = meanMax(pts, func(p domain.ProfilePoint) *float64 { return p.HR })
	s.AvgCad, _ = meanMax(pts, func(p domain.ProfilePoint) *float64 { return p.Cad })
	s.AvgTemp, _ = meanMax(pts, func(p domain.ProfilePoint) *float64 { return p.Temp })
	return s
}

// elevationStats computes gain/loss on a moving average to limit GPS noise.
func elevationStats(pts []domain.ProfilePoint) (gain, loss, minEle, maxEle float64, ok bool) {
	var idx []int
	for i := range pts {
		if e := pts[i].Ele; e != nil {
			if !ok {
				minEle, maxEle, ok = *e, *e, true
			}
			minEle, maxEle = min(minEle, *e), max(maxEle, *e)
			idx = append(idx, i)
		}
	}
	if !ok {
		return
	}
	smoothed := make([]float64, len(idx))
	for k := range idx {
		// Symmetric window that shrinks at the ends so endpoints are not biased.
		r := min(eleSmoothRadius, k, len(idx)-1-k)
		sum, n := 0.0, 0
		for j := k - r; j <= k+r; j++ {
			sum += *pts[idx[j]].Ele
			n++
		}
		smoothed[k] = sum / float64(n)
	}
	for k := 1; k < len(smoothed); k++ {
		if pts[idx[k]].Segment != pts[idx[k-1]].Segment {
			continue
		}
		if d := smoothed[k] - smoothed[k-1]; d > 0 {
			gain += d
		} else {
			loss -= d
		}
	}
	return
}

func meanMax(pts []domain.ProfilePoint, get func(domain.ProfilePoint) *float64) (mean, maxV *float64) {
	sum, n := 0.0, 0
	for _, p := range pts {
		if v := get(p); v != nil {
			sum += *v
			n++
			if maxV == nil || *v > *maxV {
				maxV = ptr(*v)
			}
		}
	}
	if n > 0 {
		mean = ptr(sum / float64(n))
	}
	return
}

// downsample keeps points at regular distance and time intervals, plus segment
// boundaries and elevation extremes, so both axes keep their shape.
func downsample(pts []domain.ProfilePoint, maxPoints int) []domain.ProfilePoint {
	n := len(pts)
	if maxPoints <= 0 || n <= maxPoints {
		return pts
	}
	keep := make(map[int]bool, maxPoints+8)
	keep[0], keep[n-1] = true, true

	minI, maxI := -1, -1
	for i := range pts {
		if i > 0 && pts[i].Segment != pts[i-1].Segment {
			keep[i-1], keep[i] = true, true
		}
		if e := pts[i].Ele; e != nil {
			if minI < 0 || *e < *pts[minI].Ele {
				minI = i
			}
			if maxI < 0 || *e > *pts[maxI].Ele {
				maxI = i
			}
		}
	}
	if minI >= 0 {
		keep[minI], keep[maxI] = true, true
	}

	budget := max(1, float64(maxPoints-len(keep))/2)
	distStep := pts[n-1].DistM / budget
	var timeStep float64
	if last := pts[n-1].ElapsedS; last != nil {
		timeStep = *last / budget
	} else {
		distStep = pts[n-1].DistM / (budget * 2)
	}
	nextDist, nextTime := 0.0, 0.0
	for i := range pts {
		if distStep > 0 && pts[i].DistM >= nextDist {
			keep[i] = true
			nextDist = pts[i].DistM + distStep
		}
		if e := pts[i].ElapsedS; timeStep > 0 && e != nil && *e >= nextTime {
			keep[i] = true
			nextTime = *e + timeStep
		}
	}

	idx := make([]int, 0, len(keep))
	for i := range keep {
		idx = append(idx, i)
	}
	sort.Ints(idx)
	out := make([]domain.ProfilePoint, len(idx))
	for k, i := range idx {
		out[k] = pts[i]
	}
	return out
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const rad = math.Pi / 180
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * earthRadiusM * math.Asin(math.Min(1, math.Sqrt(a)))
}

func ptr(v float64) *float64 { return &v }
