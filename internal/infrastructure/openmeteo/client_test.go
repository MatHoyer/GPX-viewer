package openmeteo

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func serve(t *testing.T, body string) (*httptest.Server, *url.Values) {
	t.Helper()
	var q url.Values
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q = r.URL.Query()
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv, &q
}

func TestHourly(t *testing.T) {
	// Recorded from the public API for 2024-07-01.
	body, err := os.ReadFile("testdata/two_locations.json")
	if err != nil {
		t.Fatal(err)
	}
	srv, q := serve(t, string(body))
	low, high := 1000.0, 2500.0
	at := time.Date(2024, 7, 1, 13, 0, 0, 0, time.UTC)
	got, err := NewClient(srv.URL).Hourly(context.Background(), []domain.WeatherQuery{
		{Time: at, Lat: 45.9, Lon: 6.8, Ele: &low},
		{Time: at.Add(20 * time.Minute), Lat: 45.95, Lon: 6.85, Ele: &high},
	})
	if err != nil {
		t.Fatal(err)
	}
	if q.Get("latitude") != "45.90000,45.95000" || q.Get("elevation") != "1000,2500" ||
		q.Get("start_date") != "2024-07-01" || q.Get("end_date") != "2024-07-01" {
		t.Errorf("query = %v", *q)
	}
	want := []domain.WeatherHour{
		{Time: at, Lat: 45.9, Lon: 6.8, TempC: 17.3, FeelsLikeC: 19.2, PrecipMM: 7.2, WindKmh: 1.8, GustKmh: 34.2, CloudPct: 100, Code: 63},
		{Time: at, Lat: 45.95, Lon: 6.85, TempC: 7.4, FeelsLikeC: 6.3, PrecipMM: 0.1, WindKmh: 4.4, GustKmh: 20.2, CloudPct: 81, Code: 51},
	}
	if len(got) != 2 || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("got %+v", got)
	}
}

func TestHourlySingleLocationWithoutElevation(t *testing.T) {
	srv, q := serve(t, `{"hourly":{"time":["2024-07-01T00:00","2024-07-01T01:00"],
		"temperature_2m":[1,2],"apparent_temperature":[0,1],"precipitation":[0,0.5],"snowfall":[0,0.3],
		"wind_speed_10m":[3,4],"wind_gusts_10m":[5,6],"cloud_cover":[null,90],"weather_code":[0,71]}}`)
	got, err := NewClient(srv.URL).Hourly(context.Background(), []domain.WeatherQuery{
		{Time: time.Date(2024, 7, 1, 1, 30, 0, 0, time.UTC), Lat: 1, Lon: 2},
	})
	if err != nil {
		t.Fatal(err)
	}
	if q.Has("elevation") {
		t.Errorf("elevation sent without track elevation")
	}
	if len(got) != 1 || got[0].TempC != 2 || got[0].SnowCM != 0.3 || got[0].Code != 71 || got[0].CloudPct != 90 {
		t.Errorf("got %+v", got)
	}
}

func TestHourlyMissingData(t *testing.T) {
	srv, _ := serve(t, `{"hourly":{"time":["2024-07-01T00:00"],"temperature_2m":[null]}}`)
	_, err := NewClient(srv.URL).Hourly(context.Background(), []domain.WeatherQuery{
		{Time: time.Date(2024, 7, 1, 0, 0, 0, 0, time.UTC)},
	})
	if err == nil || !strings.Contains(err.Error(), "no data") {
		t.Errorf("err = %v", err)
	}
}
