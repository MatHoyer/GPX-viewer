package middleware

import (
	"net"
	"net/http"
	"strings"
)

// CloudflareIP sets RemoteAddr to the CF-Connecting-IP header, which the
// Cloudflare edge sets and overwrites on every request, so the logger and the
// rate limiters see the real client. It replaces chi's RealIP: behind the
// tunnel, X-Real-IP and X-Forwarded-For only hold the cloudflared pod, and
// True-Client-IP may come from the client. Without the header (local dev)
// RemoteAddr is left as the socket address.
func CloudflareIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ip := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); net.ParseIP(ip) != nil {
			r.RemoteAddr = ip
		}
		next.ServeHTTP(w, r)
	})
}
