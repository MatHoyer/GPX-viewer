package overpass

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestPeaks(t *testing.T) {
	var query string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		v, _ := url.ParseQuery(string(body))
		query = v.Get("data")
		_, _ = io.WriteString(w, `{"elements":[
			{"type":"node","id":1,"lat":45.9,"lon":6.8,"tags":{"natural":"peak","name":"Aiguillette des Houches","ele":"2285 m"}},
			{"type":"node","id":2,"lat":45.91,"lon":6.81,"tags":{"natural":"peak","name":"Pointe","ele":"high"}},
			{"type":"node","id":3,"lat":45.92,"lon":6.82,"tags":{"natural":"peak","name":"  "}}]}`)
	}))
	defer srv.Close()

	peaks, err := NewClient(srv.URL).Peaks(context.Background(), domain.Bounds{MinLon: 6.7, MinLat: 45.8, MaxLon: 7, MaxLat: 46})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(query, "(45.800000,6.700000,46.000000,7.000000)") {
		t.Errorf("query = %s", query)
	}
	if len(peaks) != 2 || peaks[0].Name != "Aiguillette des Houches" || peaks[0].EleM == nil || *peaks[0].EleM != 2285 || peaks[1].EleM != nil {
		t.Errorf("peaks = %+v", peaks)
	}
}

func TestParseEle(t *testing.T) {
	for in, want := range map[string]float64{"2285": 2285, "2285 m": 2285, "1234,5": 1234.5, " 800m ": 800} {
		if got := parseEle(in); got == nil || *got != want {
			t.Errorf("parseEle(%q) = %v", in, got)
		}
	}
	if parseEle("") != nil || parseEle("~2000") != nil {
		t.Error("parsed garbage")
	}
}
