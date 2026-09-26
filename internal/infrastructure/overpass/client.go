// Package overpass fetches OpenStreetMap peaks from an Overpass API server.
package overpass

import (
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

// DefaultURL is the main public Overpass instance.
const DefaultURL = "https://overpass-api.de/api/interpreter"

type Client struct {
	url  string
	http *http.Client
}

func NewClient(endpoint string) *Client {
	return &Client{url: endpoint, http: &http.Client{Timeout: 5 * time.Minute}}
}

type response struct {
	Elements []struct {
		ID   int64             `json:"id"`
		Lat  float64           `json:"lat"`
		Lon  float64           `json:"lon"`
		Tags map[string]string `json:"tags"`
	} `json:"elements"`
}

// Peaks returns the named natural=peak nodes inside bbox.
func (c *Client) Peaks(ctx context.Context, bbox domain.Bounds) ([]domain.Peak, error) {
	query := fmt.Sprintf(`[out:json][timeout:240];node["natural"="peak"]["name"](%f,%f,%f,%f);out;`,
		bbox.MinLat, bbox.MinLon, bbox.MaxLat, bbox.MaxLon)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, strings.NewReader(url.Values{"data": {query}}.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "gpx-viewer peak import")
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("overpass: %s", res.Status)
	}
	var body response
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("overpass: decode: %w", err)
	}
	peaks := make([]domain.Peak, 0, len(body.Elements))
	for _, e := range body.Elements {
		p := domain.Peak{ID: e.ID, Name: strings.TrimSpace(e.Tags["name"]), Lon: e.Lon, Lat: e.Lat}
		if p.Name == "" {
			continue
		}
		p.EleM = parseEle(e.Tags["ele"])
		peaks = append(peaks, p)
	}
	return peaks, nil
}

// parseEle reads an OSM ele tag such as "2285", "2285 m" or "2285,5".
func parseEle(s string) *float64 {
	s = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(s), "m"))
	v, err := strconv.ParseFloat(strings.ReplaceAll(s, ",", "."), 64)
	if err != nil {
		return nil
	}
	return &v
}
