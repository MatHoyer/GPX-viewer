// Package openmeteo fetches past weather from the Open-Meteo historical API.
package openmeteo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const hourly = "temperature_2m,apparent_temperature,precipitation,snowfall,wind_speed_10m,wind_gusts_10m,cloud_cover,weather_code"

type Client struct {
	url  string
	http *http.Client
}

func NewClient(endpoint string) *Client {
	return &Client{url: endpoint, http: &http.Client{Timeout: 30 * time.Second}}
}

type location struct {
	Hourly struct {
		Time        []string   `json:"time"`
		Temp        []*float64 `json:"temperature_2m"`
		FeelsLike   []*float64 `json:"apparent_temperature"`
		Precip      []*float64 `json:"precipitation"`
		Snow        []*float64 `json:"snowfall"`
		Wind        []*float64 `json:"wind_speed_10m"`
		Gust        []*float64 `json:"wind_gusts_10m"`
		Cloud       []*float64 `json:"cloud_cover"`
		WeatherCode []*float64 `json:"weather_code"`
	} `json:"hourly"`
}

// Hourly asks for every query's place over the days they span, then keeps
// each place's hour. Queries must be in time order.
func (c *Client) Hourly(ctx context.Context, qs []domain.WeatherQuery) ([]domain.WeatherHour, error) {
	if len(qs) == 0 {
		return nil, nil
	}
	lats, lons, eles := make([]string, len(qs)), make([]string, len(qs)), make([]string, len(qs))
	withEle := true
	for i, q := range qs {
		lats[i] = strconv.FormatFloat(q.Lat, 'f', 5, 64)
		lons[i] = strconv.FormatFloat(q.Lon, 'f', 5, 64)
		if q.Ele == nil {
			withEle = false
		} else {
			eles[i] = strconv.FormatFloat(*q.Ele, 'f', 0, 64)
		}
	}
	day := qs[0].Time.UTC().Truncate(24 * time.Hour)
	v := url.Values{
		"latitude":   {strings.Join(lats, ",")},
		"longitude":  {strings.Join(lons, ",")},
		"start_date": {day.Format(time.DateOnly)},
		"end_date":   {qs[len(qs)-1].Time.UTC().Format(time.DateOnly)},
		"hourly":     {hourly},
		"timezone":   {"GMT"},
	}
	// The track's own elevation corrects temperature for altitude; without
	// it Open-Meteo falls back to a terrain model.
	if withEle {
		v.Set("elevation", strings.Join(eles, ","))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url+"?"+v.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "gpx-viewer weather")
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("open-meteo: %s", res.Status)
	}
	var raw json.RawMessage
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("open-meteo: decode: %w", err)
	}
	// One location comes back as an object, several as an array.
	if !bytes.HasPrefix(bytes.TrimSpace(raw), []byte("[")) {
		raw = append(append([]byte("["), raw...), ']')
	}
	var locs []location
	if err := json.Unmarshal(raw, &locs); err != nil {
		return nil, fmt.Errorf("open-meteo: decode: %w", err)
	}
	if len(locs) != len(qs) {
		return nil, fmt.Errorf("open-meteo: %d locations for %d queries", len(locs), len(qs))
	}
	out := make([]domain.WeatherHour, len(qs))
	for i, q := range qs {
		h := locs[i].Hourly
		t := q.Time.UTC().Truncate(time.Hour)
		k := int(t.Sub(day) / time.Hour)
		if k < 0 || k >= len(h.Time) || h.Time[k] != t.Format("2006-01-02T15:04") {
			return nil, fmt.Errorf("open-meteo: no data at %s", t)
		}
		w := domain.WeatherHour{Time: t, Lat: q.Lat, Lon: q.Lon}
		for _, f := range []struct {
			dst *float64
			src []*float64
		}{
			{&w.TempC, h.Temp}, {&w.FeelsLikeC, h.FeelsLike}, {&w.PrecipMM, h.Precip}, {&w.SnowCM, h.Snow},
			{&w.WindKmh, h.Wind}, {&w.GustKmh, h.Gust},
		} {
			if k >= len(f.src) || f.src[k] == nil {
				return nil, fmt.Errorf("open-meteo: no data at %s", t)
			}
			*f.dst = *f.src[k]
		}
		if k < len(h.Cloud) && h.Cloud[k] != nil {
			w.CloudPct = int(*h.Cloud[k])
		}
		if k < len(h.WeatherCode) && h.WeatherCode[k] != nil {
			w.Code = int(*h.WeatherCode[k])
		}
		out[i] = w
	}
	return out, nil
}
