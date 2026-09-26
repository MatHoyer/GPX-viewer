package hike

import (
	"math"
	"testing"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

var t0 = time.Date(2026, 7, 1, 8, 0, 0, 0, time.UTC)

func f(v float64) *float64 { return &v }

func at(s float64) *time.Time {
	t := t0.Add(time.Duration(s * float64(time.Second)))
	return &t
}

// line builds n samples going north, one every stepS seconds,
// with a latitude step of ~11.1 m (0.0001°).
func line(n int, stepS float64) []domain.Sample {
	out := make([]domain.Sample, n)
	for i := range out {
		out[i] = domain.Sample{Lon: 6, Lat: 45 + float64(i)*0.0001, Time: at(float64(i) * stepS), Ele: f(1000 + float64(i))}
	}
	return out
}

func near(a, b, tol float64) bool { return math.Abs(a-b) <= tol }

func TestBuildProfileDistanceAndTime(t *testing.T) {
	p := BuildProfile(line(11, 10), 0)
	if !p.Has.Time || !p.Has.Ele || p.Has.HR {
		t.Errorf("has = %+v", p.Has)
	}
	if !near(p.Summary.DistanceM, 111.2, 0.5) {
		t.Errorf("distance = %v", p.Summary.DistanceM)
	}
	if *p.Summary.ElapsedS != 100 || *p.Summary.MovingS != 100 {
		t.Errorf("elapsed = %v moving = %v", *p.Summary.ElapsedS, *p.Summary.MovingS)
	}
	if !near(*p.Summary.AvgSpeedMS, 1.112, 0.01) {
		t.Errorf("avg speed = %v", *p.Summary.AvgSpeedMS)
	}
	if !near(p.Summary.ElevationGainM, 10, 0.01) || p.Summary.ElevationLossM != 0 {
		t.Errorf("gain = %v loss = %v", p.Summary.ElevationGainM, p.Summary.ElevationLossM)
	}
	if *p.Summary.MinEle != 1000 || *p.Summary.MaxEle != 1010 {
		t.Errorf("ele range = %v..%v", *p.Summary.MinEle, *p.Summary.MaxEle)
	}
	for i, pt := range p.Points {
		if pt.SpeedMS == nil || !near(*pt.SpeedMS, 1.112, 0.01) {
			t.Errorf("speed[%d] = %v", i, pt.SpeedMS)
		}
	}
}

func TestBuildProfileSegmentGapIsNotDistance(t *testing.T) {
	s := line(4, 10)
	s[2].Segment, s[3].Segment = 1, 1
	s[2].Lat, s[3].Lat = 46, 46.0001 // far away jump
	p := BuildProfile(s, 0)
	if !near(p.Summary.DistanceM, 22.2, 0.2) {
		t.Errorf("distance = %v, gap should not count", p.Summary.DistanceM)
	}
}

func TestBuildProfileIgnoresSpeedSpike(t *testing.T) {
	s := line(61, 1)
	s[30].Lat += 0.01 // ~1.1 km teleport for one fix
	p := BuildProfile(s, 0)
	if p.Summary.MaxSpeedMS != nil && *p.Summary.MaxSpeedMS > maxPlausibleSpeed {
		t.Errorf("max speed = %v", *p.Summary.MaxSpeedMS)
	}
}

func TestBuildProfileWithoutTime(t *testing.T) {
	s := line(5, 10)
	for i := range s {
		s[i].Time, s[i].Ele = nil, nil
	}
	p := BuildProfile(s, 0)
	if p.Has.Time || p.Has.Ele {
		t.Errorf("has = %+v", p.Has)
	}
	if p.Summary.ElapsedS != nil || p.Summary.MovingS != nil || p.Summary.MinEle != nil {
		t.Errorf("summary = %+v", p.Summary)
	}
	if p.Points[4].SpeedMS != nil || p.Points[4].DistM == 0 {
		t.Errorf("last point = %+v", p.Points[4])
	}
}

func TestBuildProfileSensorsSummary(t *testing.T) {
	s := line(3, 10)
	s[0].HR, s[1].HR, s[2].HR = f(100), f(120), f(140)
	s[1].Cad = f(80)
	p := BuildProfile(s, 0)
	if !p.Has.HR || !p.Has.Cad || p.Has.Temp {
		t.Errorf("has = %+v", p.Has)
	}
	if *p.Summary.AvgHR != 120 || *p.Summary.MaxHR != 140 || *p.Summary.AvgCad != 80 || p.Summary.AvgTemp != nil {
		t.Errorf("summary = %+v", p.Summary)
	}
}

func TestDownsampleKeepsShape(t *testing.T) {
	s := line(10000, 1)
	*s[4321].Ele = 20000 // summit
	*s[7777].Ele = -50   // valley
	s[5000].Segment = 1  // start of a second segment
	for i := 5001; i < len(s); i++ {
		s[i].Segment = 1
	}
	p := BuildProfile(s, 500)

	if n := len(p.Points); n > 520 || n < 200 {
		t.Errorf("len = %d", n)
	}
	first, last := p.Points[0], p.Points[len(p.Points)-1]
	if first.DistM != 0 || !last.Time.Equal(*s[9999].Time) {
		t.Errorf("endpoints not kept")
	}
	var summit, valley, segStart, segEnd bool
	for _, pt := range p.Points {
		summit = summit || *pt.Ele == 20000
		valley = valley || *pt.Ele == -50
		segStart = segStart || pt.Time.Equal(*s[5000].Time)
		segEnd = segEnd || pt.Time.Equal(*s[4999].Time)
	}
	if !summit || !valley || !segStart || !segEnd {
		t.Errorf("summit %v valley %v segStart %v segEnd %v", summit, valley, segStart, segEnd)
	}
	for i := 1; i < len(p.Points); i++ {
		if p.Points[i].DistM < p.Points[i-1].DistM {
			t.Fatalf("points out of order at %d", i)
		}
	}
	// Summary is computed before downsampling (the spike stays within max).
	if *p.Summary.MaxEle != 20000 || !near(p.Summary.DistanceM, 9998*11.12, 20) {
		t.Errorf("summary = max %v dist %v", *p.Summary.MaxEle, p.Summary.DistanceM)
	}
}
