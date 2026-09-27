package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
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
