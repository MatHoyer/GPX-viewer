package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const SessionCookie = "session"

type ctxKey struct{}

type Authenticator interface {
	Authenticate(ctx context.Context, token string) (*domain.User, error)
}

// RequireAuth resolves the session cookie and rejects unauthenticated requests.
func RequireAuth(auth Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie(SessionCookie)
			if err != nil {
				unauthorized(w)
				return
			}
			u, err := auth.Authenticate(r.Context(), c.Value)
			if err != nil {
				if !errors.Is(err, domain.ErrUnauthorized) {
					slog.Error("authenticate", "err", err)
					http.Error(w, "internal server error", http.StatusInternalServerError)
					return
				}
				unauthorized(w)
				return
			}
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
		})
	}
}

// UserFrom returns the authenticated user. Only valid behind RequireAuth.
func UserFrom(ctx context.Context) *domain.User {
	u, _ := ctx.Value(ctxKey{}).(*domain.User)
	return u
}

// RejectCrossSite blocks state-changing requests coming from other sites.
func RejectCrossSite(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
		default:
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				http.Error(w, "cross-site request rejected", http.StatusForbidden)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
}
