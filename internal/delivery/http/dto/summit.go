package dto

import (
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Peak struct {
	ID   int64    `json:"id"`
	Name string   `json:"name"`
	EleM *float64 `json:"eleM"`
	Lon  float64  `json:"lon"`
	Lat  float64  `json:"lat"`
}

func NewPeaks(peaks []domain.Peak) []Peak {
	out := make([]Peak, len(peaks))
	for i, p := range peaks {
		out[i] = Peak{ID: p.ID, Name: p.Name, EleM: p.EleM, Lon: p.Lon, Lat: p.Lat}
	}
	return out
}

type SummitVisit struct {
	HikeID    string     `json:"hikeId"`
	StartedAt *time.Time `json:"startedAt"`
}

type Summit struct {
	Peak   Peak          `json:"peak"`
	Visits []SummitVisit `json:"visits"`
}

func NewSummits(summits []domain.Summit) []Summit {
	out := make([]Summit, len(summits))
	for i, s := range summits {
		visits := make([]SummitVisit, len(s.Visits))
		for j, v := range s.Visits {
			visits[j] = SummitVisit{HikeID: v.HikeID.String(), StartedAt: v.StartedAt}
		}
		out[i] = Summit{Peak: NewPeaks([]domain.Peak{s.Peak})[0], Visits: visits}
	}
	return out
}
