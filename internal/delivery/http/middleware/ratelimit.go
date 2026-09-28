package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/httprate"
)

// Limiter caps how many requests one client makes to an endpoint within a
// sliding window. Counters live in memory, so they reset on restart and are
// not shared between replicas.
type Limiter struct {
	rl      *httprate.RateLimiter
	window  time.Duration
	message string
}

// NewLimiter allows n requests per window. what names the action in the
// error, e.g. "sign-in attempts".
func NewLimiter(n int, window time.Duration, what string) *Limiter {
	return &Limiter{
		rl:      httprate.NewRateLimiter(n, window),
		window:  window,
		message: fmt.Sprintf("Too many %s. Try again in %s.", what, humanize(window)),
	}
}

// ByIP limits per client IP. The IP comes from RemoteAddr, which RealIP fills
// from a trusted proxy's header.
func (l *Limiter) ByIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if l.limited(w, r, "ip:"+clientIP(r)) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ByUser limits per signed-in user. It must run behind RequireAuth.
func (l *Limiter) ByUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if l.limited(w, r, "user:"+UserFrom(r.Context()).ID.String()) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ByEmail limits per "email" field of the JSON body, so one account cannot be
// targeted from many IPs. Requests without an email are not counted; the
// handler rejects them anyway.
func (l *Limiter) ByEmail(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		var in struct {
			Email string `json:"email"`
		}
		_ = json.Unmarshal(body, &in)
		if email := strings.ToLower(strings.TrimSpace(in.Email)); email != "" && l.limited(w, r, "email:"+email) {
			return
		}
		next.ServeHTTP(w, r)
	})
}

// limited counts the request against key and answers 429 once over the limit.
func (l *Limiter) limited(w http.ResponseWriter, r *http.Request, key string) bool {
	if !l.rl.OnLimit(w, r, key) {
		return false
	}
	seconds := int(l.window.Seconds())
	w.Header().Set("Retry-After", strconv.Itoa(seconds))
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusTooManyRequests)
	_ = json.NewEncoder(w).Encode(struct {
		Error      string `json:"error"`
		RetryAfter int    `json:"retryAfter"`
	}{l.message, seconds})
	return true
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		host = r.RemoteAddr
	}
	return httprate.CanonicalizeIP(host)
}

func humanize(d time.Duration) string {
	unit, n := "second", int(d.Seconds())
	switch {
	case d >= time.Hour && d%time.Hour == 0:
		unit, n = "hour", int(d.Hours())
	case d >= time.Minute && d%time.Minute == 0:
		unit, n = "minute", int(d.Minutes())
	}
	if n == 1 {
		return "1 " + unit
	}
	return fmt.Sprintf("%d %ss", n, unit)
}
