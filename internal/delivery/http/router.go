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
	Summits       *handler.SummitHandler
	Interactions  *handler.InteractionHandler
	Admin         *handler.AdminHandler
	Authenticator middleware.Authenticator
	// Static is the built frontend (index.html at its root). Optional.
	Static fs.FS
	// AppURL is the public base URL, used for canonical links and the sitemap.
	AppURL string
	// HikeMeta finds public hikes to describe in link previews of their pages. Optional.
	HikeMeta HikeMeta
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, middleware.CloudflareIP, middleware.ClientInfo, chimw.Logger, chimw.Recoverer)

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
		deleteAccount := middleware.NewLimiter(5, time.Minute, "account deletion attempts")

		r.Get("/config", d.Admin.Config)
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
			r.With(deleteAccount.ByUser).Delete("/me", d.Auth.DeleteAccount)
			r.Get("/me/sessions", d.Auth.Sessions)
			r.Delete("/me/sessions", d.Auth.RevokeOtherSessions)
			r.Delete("/me/sessions/{id}", d.Auth.RevokeSession)

			r.Get("/hikes", d.Hikes.List)
			r.Post("/hikes", d.Hikes.Upload)
			r.Get("/hikes/tracks", d.Hikes.Tracks)
			r.Get("/hikes/export", d.Hikes.Export)
			r.Post("/hikes/export", d.Hikes.ExportSelected)
			r.Post("/hikes/delete", d.Hikes.DeleteMany)
			r.Get("/labels", d.Hikes.Labels)
			r.Get("/tiles", d.Hikes.Tiles)
			r.Get("/summits", d.Summits.Mine)
			r.Get("/feed", d.Hikes.Feed)
			r.Patch("/hikes/{id}", d.Hikes.Update)
			r.Post("/hikes/{id}/done", d.Hikes.MarkDone)
			r.Delete("/hikes/{id}", d.Hikes.Delete)
			r.Get("/hikes/{id}/similar", d.Hikes.Similar)
			r.Put("/hikes/{id}/kudos", d.Interactions.GiveKudos)
			r.Delete("/hikes/{id}/kudos", d.Interactions.TakeKudos)
			r.Post("/hikes/{id}/comments", d.Interactions.PostComment)
			r.Delete("/hikes/{id}/comments/{commentId}", d.Interactions.DeleteComment)
			r.Put("/hikes/{id}/participants/{userId}", d.Hikes.Tag)
			r.Delete("/hikes/{id}/participants/{userId}", d.Hikes.Untag)

			r.Get("/friends", d.Social.Friends)
			r.Put("/friends/{id}", d.Social.AddFriend)
			r.Delete("/friends/{id}", d.Social.RemoveFriend)

			r.Route("/admin", func(r chi.Router) {
				r.Use(middleware.RequireAdmin)
				r.Get("/users", d.Admin.Users)
				r.Get("/users/{id}", d.Admin.User)
				r.Get("/users/{id}/sessions", d.Admin.Sessions)
				r.Delete("/users/{id}/sessions", d.Admin.RevokeSessions)
				r.Delete("/users/{id}/sessions/{sessionId}", d.Admin.RevokeSession)
				r.Post("/users", d.Admin.CreateUser)
				r.Post("/users/{id}/invite", d.Admin.Invite)
				r.Delete("/users/{id}/invite", d.Admin.RevokeInvite)
				r.Put("/users/{id}/ban", d.Admin.Ban)
				r.Delete("/users/{id}/ban", d.Admin.Unban)
				r.Put("/users/{id}/admin", d.Admin.Promote)
				r.Delete("/users/{id}/admin", d.Admin.Demote)
			})
		})

		// Readable by anyone the owner's visibility allows, signed in or not.
		r.Group(func(r chi.Router) {
			r.Use(middleware.OptionalAuth(d.Authenticator))

			r.Get("/hikes/{id}", d.Hikes.Get)
			r.Get("/hikes/{id}/profile", d.Hikes.Profile)
			r.Get("/hikes/{id}/gpx", d.Hikes.GPX)
			r.Get("/hikes/{id}/card.png", d.Hikes.Card)
			r.Get("/hikes/{id}/summits", d.Summits.OnHike)
			r.Get("/hikes/{id}/comments", d.Interactions.Comments)

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
		if d.HikeMeta != nil {
			r.Get("/hikes/{id}", hikePageHandler(d.Static, d.AppURL, d.HikeMeta))
		}
		r.Handle("/*", spaHandler(d.Static))
	}
	return r
}
