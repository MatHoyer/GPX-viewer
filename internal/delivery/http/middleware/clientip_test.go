package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestCloudflareIP(t *testing.T) {
	tests := []struct {
		name    string
		headers map[string]string
		want    string
	}{
		{"uses CF-Connecting-IP", map[string]string{"CF-Connecting-IP": "1.1.1.1"}, "1.1.1.1"},
		{"accepts IPv6", map[string]string{"CF-Connecting-IP": "2001:db8::1"}, "2001:db8::1"},
		{"ignores spoofable headers", map[string]string{
			"True-Client-IP":  "6.6.6.6",
			"X-Real-IP":       "6.6.6.6",
			"X-Forwarded-For": "6.6.6.6",
		}, "10.42.0.5:1234"},
		{"keeps socket address on invalid header", map[string]string{"CF-Connecting-IP": "nope"}, "10.42.0.5:1234"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = "10.42.0.5:1234"
			for k, v := range tt.headers {
				r.Header.Set(k, v)
			}
			var got string
			CloudflareIP(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = r.RemoteAddr
			})).ServeHTTP(httptest.NewRecorder(), r)
			if got != tt.want {
				t.Errorf("RemoteAddr = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestClientInfo(t *testing.T) {
	for _, tc := range []struct{ remote, cf, want string }{
		{"[::1]:1234", "", "::1"},
		{"10.0.0.5:1234", "", "10.0.0.5"},
		{"10.0.0.5:1234", "2001:db8::42", "2001:db8::42"},
	} {
		var got domain.Client
		h := CloudflareIP(ClientInfo(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
			got = domain.ClientFrom(r.Context())
		})))
		r := httptest.NewRequest(http.MethodGet, "/", nil)
		r.RemoteAddr = tc.remote
		r.Header.Set("User-Agent", "ua")
		if tc.cf != "" {
			r.Header.Set("CF-Connecting-IP", tc.cf)
		}
		h.ServeHTTP(httptest.NewRecorder(), r)
		if got.IP != tc.want || got.UserAgent != "ua" {
			t.Errorf("%s/%s: client = %+v, want ip %s", tc.remote, tc.cf, got, tc.want)
		}
	}
}
