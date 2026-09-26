package http

import (
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/handler"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
)

type Deps struct {
	Auth          *handler.AuthHandler
	Account       *handler.AccountHandler
	Hikes         *handler.HikeHandler
	Authenticator middleware.Authenticator
	// Static is the built frontend (index.html at its root). Optional.
	Static fs.FS
}

func NewRouter(d Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(chimw.RequestID, chimw.RealIP, chimw.Logger, chimw.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.RejectCrossSite)

		r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		})

		r.Post("/auth/register", d.Auth.Register)
		r.Post("/auth/login", d.Auth.Login)
		r.Post("/auth/logout", d.Auth.Logout)

		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireAuth(d.Authenticator))
			r.Get("/auth/me", d.Auth.Me)

			r.Patch("/me", d.Account.Update)
			r.Get("/me/avatar", d.Account.Avatar)
			r.Put("/me/avatar", d.Account.UploadAvatar)
			r.Delete("/me/avatar", d.Account.DeleteAvatar)

			r.Get("/hikes", d.Hikes.List)
			r.Post("/hikes", d.Hikes.Upload)
			r.Get("/hikes/tracks", d.Hikes.Tracks)
			r.Get("/hikes/{id}", d.Hikes.Get)
			r.Get("/hikes/{id}/profile", d.Hikes.Profile)
			r.Patch("/hikes/{id}", d.Hikes.Update)
			r.Delete("/hikes/{id}", d.Hikes.Delete)
		})

		r.NotFound(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":"not found"}` + "\n"))
		})
	})

	if d.Static != nil {
		r.Handle("/*", spaHandler(d.Static))
	}
	return r
}
