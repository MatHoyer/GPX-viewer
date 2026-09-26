package http

import (
	"io/fs"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/handler"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
)

type Deps struct {
	Auth          *handler.AuthHandler
	Account       *handler.AccountHandler
	Hikes         *handler.HikeHandler
	Social        *handler.SocialHandler
	Authenticator middleware.Authenticator
	// Static is the built frontend (index.html at its root). Optional.
	Static fs.FS
	// AppURL is the public base URL, used for canonical links and the sitemap.
	AppURL string
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Logger, chimw.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.RejectCrossSite)

		r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})

		// Guessing passwords and sending emails are the abusable endpoints.
		loginByIP := middleware.NewLimiter(10, time.Minute, "sign-in attempts")
		loginByEmail := middleware.NewLimiter(5, time.Minute, "sign-in attempts for this account")
		register := middleware.NewLimiter(5, time.Hour, "accounts created from your network")
		forgot := middleware.NewLimiter(5, 15*time.Minute, "password reset requests")
		verify := middleware.NewLimiter(10, time.Minute, "attempts")
		reset := middleware.NewLimiter(10, time.Minute, "attempts")
		changePassword := middleware.NewLimiter(5, time.Minute, "password change attempts")

		r.With(register.ByIP).Post("/auth/register", d.Auth.Register)
		r.With(loginByIP.ByIP, loginByEmail.ByEmail).Post("/auth/login", d.Auth.Login)
		r.Post("/auth/logout", d.Auth.Logout)
		r.With(verify.ByIP).Post("/auth/verify", d.Auth.VerifyEmail)
		r.With(forgot.ByIP).Post("/auth/password/forgot", d.Auth.ForgotPassword)
		r.With(reset.ByIP).Post("/auth/password/reset", d.Auth.ResetPassword)

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(d.Authenticator))
			r.Get("/auth/me", d.Auth.Me)
			r.With(changePassword.ByUser).Post("/auth/password", d.Auth.ChangePassword)

			r.Patch("/me", d.Account.Update)

			r.Get("/hikes", d.Hikes.List)
			r.Post("/hikes", d.Hikes.Upload)
			r.Get("/hikes/tracks", d.Hikes.Tracks)
			r.Get("/hikes/export", d.Hikes.Export)
			r.Patch("/hikes/{id}", d.Hikes.Update)
			r.Delete("/hikes/{id}", d.Hikes.Delete)
			r.Put("/hikes/{id}/participants/{userId}", d.Hikes.Tag)
			r.Delete("/hikes/{id}/participants/{userId}", d.Hikes.Untag)

			r.Get("/friends", d.Social.Friends)
			r.Put("/friends/{id}", d.Social.AddFriend)
			r.Delete("/friends/{id}", d.Social.RemoveFriend)
		})

		// Readable by anyone the owner's visibility allows, signed in or not.
		r.Group(func(r chi.Router) {
			r.Use(middleware.OptionalAuth(d.Authenticator))

			r.Get("/hikes/{id}", d.Hikes.Get)
			r.Get("/hikes/{id}/profile", d.Hikes.Profile)
			r.Get("/hikes/{id}/gpx", d.Hikes.GPX)

			r.Get("/users/{id}", d.Social.Profile)
			r.Get("/users/{id}/hikes", d.Hikes.UserList)
			r.Get("/users/{id}/hikes/tracks", d.Hikes.UserTracks)
		})

		r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"not found"}` + "\n"))
		})
	})

	r.Get("/robots.txt", robotsHandler(d.AppURL))
	r.Get("/sitemap.xml", sitemapHandler(d.AppURL))

	if d.Static != nil {
		r.With(middleware.OptionalAuth(d.Authenticator)).Handle("/", rootHandler(d.Static, d.AppURL))
		r.Handle("/*", spaHandler(d.Static))
	}
	return r
}
