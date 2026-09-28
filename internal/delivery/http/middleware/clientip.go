package middleware

import (
	"net"
	"net/http"
	"net/netip"
	"strings"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// RealIP sets RemoteAddr to the client IP a trusted reverse proxy reports
// in header, so the logger, rate limiters and sessions see the real client.
// The header is only read when the connection comes from one of trusted, so
// clients cannot pick their own IP. For X-Forwarded-For, the address taken is
// the rightmost one that is not itself a trusted proxy. Without a header,
// RemoteAddr stays the socket address.
func RealIP(header string, trusted []netip.Prefix) func(http.Handler) http.Handler {
	header = http.CanonicalHeaderKey(header)
	return func(next http.Handler) http.Handler {
		if header == "" {
			return next
		}
		isTrusted := func(a netip.Addr) bool {
			a = a.Unmap()
			for _, p := range trusted {
				if p.Contains(a) {
					return true
				}
			}
			return false
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if peer, err := netip.ParseAddrPort(r.RemoteAddr); err == nil && isTrusted(peer.Addr()) {
				if ip, ok := headerIP(r.Header.Values(header), header == "X-Forwarded-For", isTrusted); ok {
					r.RemoteAddr = ip.String()
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// headerIP reads the client IP from a header's values. A list header is
// walked from the right, past the trusted proxies that appended to it.
func headerIP(values []string, list bool, trusted func(netip.Addr) bool) (netip.Addr, bool) {
	if !list {
		if len(values) != 1 {
			return netip.Addr{}, false
		}
		a, err := netip.ParseAddr(strings.TrimSpace(values[0]))
		return a.Unmap(), err == nil
	}
	var hops []string
	for _, v := range values {
		hops = append(hops, strings.Split(v, ",")...)
	}
	for i := len(hops) - 1; i >= 0; i-- {
		a, err := netip.ParseAddr(strings.TrimSpace(hops[i]))
		if err != nil {
			return netip.Addr{}, false
		}
		if !trusted(a) {
			return a.Unmap(), true
		}
	}
	return netip.Addr{}, false
}

// ClientInfo attaches the client's user agent and IP to the request context,
// to be recorded on the sessions it starts. It must run after RealIP.
func ClientInfo(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := domain.WithClient(r.Context(), domain.Client{UserAgent: r.UserAgent(), IP: remoteIP(r)})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// remoteIP is the exact client address; clientIP groups IPv6 by network for
// rate limiting.
func remoteIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
