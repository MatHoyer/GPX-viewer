package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestRealIP(t *testing.T) {
	cluster := []netip.Prefix{netip.MustParsePrefix("10.42.0.0/16")}
	tests := []struct {
		name    string
		header  string
		trusted []netip.Prefix
		remote  string
		headers map[string][]string
		want    string
	}{
		{"no header configured keeps the socket", "", nil, "1.2.3.4:5", map[string][]string{"CF-Connecting-IP": {"6.6.6.6"}}, "1.2.3.4:5"},
		{"trusted proxy's header", "CF-Connecting-IP", cluster, "10.42.0.5:1234", map[string][]string{"CF-Connecting-IP": {"1.1.1.1"}}, "1.1.1.1"},
		{"IPv6 client", "CF-Connecting-IP", cluster, "10.42.0.5:1234", map[string][]string{"CF-Connecting-IP": {"2001:db8::1"}}, "2001:db8::1"},
		{"untrusted peer cannot pick its IP", "CF-Connecting-IP", cluster, "8.8.8.8:1234", map[string][]string{"CF-Connecting-IP": {"1.1.1.1"}}, "8.8.8.8:1234"},
		{"other headers ignored", "CF-Connecting-IP", cluster, "10.42.0.5:1234", map[string][]string{"X-Forwarded-For": {"6.6.6.6"}, "True-Client-IP": {"6.6.6.6"}}, "10.42.0.5:1234"},
		{"invalid header keeps the socket", "CF-Connecting-IP", cluster, "10.42.0.5:1234", map[string][]string{"CF-Connecting-IP": {"nope"}}, "10.42.0.5:1234"},
		{"repeated single-value header rejected", "X-Real-IP", cluster, "10.42.0.5:1234", map[string][]string{"X-Real-IP": {"1.1.1.1", "2.2.2.2"}}, "10.42.0.5:1234"},
		{"forwarded-for takes the hop before the proxies", "X-Forwarded-For", cluster, "10.42.0.5:1234",
			map[string][]string{"X-Forwarded-For": {"6.6.6.6, 1.1.1.1, 10.42.0.9"}}, "1.1.1.1"},
		{"forwarded-for across repeated headers", "X-Forwarded-For", cluster, "10.42.0.5:1234",
			map[string][]string{"X-Forwarded-For": {"6.6.6.6", "1.1.1.1"}}, "1.1.1.1"},
		{"forwarded-for with only proxies", "X-Forwarded-For", cluster, "10.42.0.5:1234",
			map[string][]string{"X-Forwarded-For": {"10.42.0.8"}}, "10.42.0.5:1234"},
		{"forwarded-for with garbage", "X-Forwarded-For", cluster, "10.42.0.5:1234",
			map[string][]string{"X-Forwarded-For": {"1.1.1.1, junk"}}, "10.42.0.5:1234"},
		{"header name is case-insensitive", "cf-connecting-ip", cluster, "10.42.0.5:1234", map[string][]string{"CF-Connecting-IP": {"1.1.1.1"}}, "1.1.1.1"},
		{"IPv4-mapped peer is trusted", "CF-Connecting-IP", cluster, "[::ffff:10.42.0.5]:1234", map[string][]string{"CF-Connecting-IP": {"1.1.1.1"}}, "1.1.1.1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.RemoteAddr = tt.remote
			for k, vs := range tt.headers {
				for _, v := range vs {
					r.Header.Add(k, v)
				}
			}
			var got string
			RealIP(tt.header, tt.trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = r.RemoteAddr
			})).ServeHTTP(httptest.NewRecorder(), r)
			if got != tt.want {
				t.Errorf("RemoteAddr = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestClientInfo(t *testing.T) {
	cluster := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}
	for _, tc := range []struct{ remote, cf, want string }{
		{"[::1]:1234", "", "::1"},
		{"10.0.0.5:1234", "", "10.0.0.5"},
		{"10.0.0.5:1234", "2001:db8::42", "2001:db8::42"},
	} {
		var got domain.Client
		h := RealIP("CF-Connecting-IP", cluster)(ClientInfo(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
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
