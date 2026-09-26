package dto

import (
	"math"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Profile is a columnar time/distance series: index i of every array is the
// same point. Optional series are omitted when the source has no such data.
type Profile struct {
	Has     ProfileHas     `json:"has"`
	Summary ProfileSummary `json:"summary"`
	Lon     []float64      `json:"lon"`
	Lat     []float64      `json:"lat"`
	Dist    []float64      `json:"dist"`
	Seg     []int          `json:"seg"`
	Ele     []*float64     `json:"ele,omitempty"`
	T       []*float64     `json:"t,omitempty"`
	Speed   []*float64     `json:"speed,omitempty"`
	HR      []*float64     `json:"hr,omitempty"`
	Cad     []*float64     `json:"cad,omitempty"`
	Temp    []*float64     `json:"temp,omitempty"`
}

type ProfileHas struct {
	Time bool `json:"time"`
	Ele  bool `json:"ele"`
	HR   bool `json:"hr"`
	Cad  bool `json:"cad"`
	Temp bool `json:"temp"`
}

type ProfileSummary struct {
	DistanceM      float64  `json:"distanceM"`
	ElevationGainM float64  `json:"elevationGainM"`
	ElevationLossM float64  `json:"elevationLossM"`
	MinEle         *float64 `json:"minEle"`
	MaxEle         *float64 `json:"maxEle"`
	ElapsedS       *float64 `json:"elapsedS"`
	MovingS        *float64 `json:"movingS"`
	AvgSpeedMS     *float64 `json:"avgSpeedMS"`
	MaxSpeedMS     *float64 `json:"maxSpeedMS"`
	AvgHR          *float64 `json:"avgHR"`
	MaxHR          *float64 `json:"maxHR"`
	AvgCad         *float64 `json:"avgCad"`
	AvgTemp        *float64 `json:"avgTemp"`
}

func NewProfile(p *domain.Profile) Profile {
	n := len(p.Points)
	out := Profile{
		Has:  ProfileHas{Time: p.Has.Time, Ele: p.Has.Ele, HR: p.Has.HR, Cad: p.Has.Cad, Temp: p.Has.Temp},
		Lon:  make([]float64, n),
		Lat:  make([]float64, n),
		Dist: make([]float64, n),
		Seg:  make([]int, n),
	}
	series := func(enabled bool) []*float64 {
		if !enabled {
			return nil
		}
		return make([]*float64, n)
	}
	out.Ele = series(p.Has.Ele)
	out.T = series(p.Has.Time)
	out.Speed = series(p.Has.Time)
	out.HR = series(p.Has.HR)
	out.Cad = series(p.Has.Cad)
	out.Temp = series(p.Has.Temp)

	for i, pt := range p.Points {
		out.Lon[i] = round(pt.Lon, 6)
		out.Lat[i] = round(pt.Lat, 6)
		out.Dist[i] = round(pt.DistM, 1)
		out.Seg[i] = pt.Segment
		set(out.Ele, i, pt.Ele, 1)
		set(out.T, i, pt.ElapsedS, 1)
		set(out.Speed, i, pt.SpeedMS, 2)
		set(out.HR, i, pt.HR, 0)
		set(out.Cad, i, pt.Cad, 0)
		set(out.Temp, i, pt.Temp, 1)
	}

	s := p.Summary
	out.Summary = ProfileSummary{
		DistanceM:      round(s.DistanceM, 1),
		ElevationGainM: round(s.ElevationGainM, 1),
		ElevationLossM: round(s.ElevationLossM, 1),
		MinEle:         roundPtr(s.MinEle, 1),
		MaxEle:         roundPtr(s.MaxEle, 1),
		ElapsedS:       roundPtr(s.ElapsedS, 0),
		MovingS:        roundPtr(s.MovingS, 0),
		AvgSpeedMS:     roundPtr(s.AvgSpeedMS, 2),
		MaxSpeedMS:     roundPtr(s.MaxSpeedMS, 2),
		AvgHR:          roundPtr(s.AvgHR, 0),
		MaxHR:          roundPtr(s.MaxHR, 0),
		AvgCad:         roundPtr(s.AvgCad, 0),
		AvgTemp:        roundPtr(s.AvgTemp, 1),
	}
	return out
}

func set(dst []*float64, i int, v *float64, digits int) {
	if dst != nil {
		dst[i] = roundPtr(v, digits)
	}
}

func round(v float64, digits int) float64 {
	p := math.Pow10(digits)
	return math.Round(v*p) / p
}

func roundPtr(v *float64, digits int) *float64 {
	if v == nil {
		return nil
	}
	r := round(*v, digits)
	return &r
}
