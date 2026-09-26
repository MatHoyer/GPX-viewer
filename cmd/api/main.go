package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/config"
	httpdelivery "github.com/MatHoyer/gpx-viewer/internal/delivery/http"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/handler"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/gpx"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/postgres"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/security"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/auth"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/hike"
	"github.com/MatHoyer/gpx-viewer/web"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	db, err := postgres.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	if err := postgres.Migrate(db); err != nil {
		return err
	}

	authSvc, err := auth.NewService(
		postgres.NewUserRepository(db),
		postgres.NewSessionRepository(db),
		security.NewBcryptHasher(0),
		cfg.SessionTTL,
	)
	if err != nil {
		return err
	}
	hikeSvc := hike.NewService(postgres.NewHikeRepository(db), gpx.NewParser())

	go purgeSessions(ctx, authSvc)

	router := httpdelivery.NewRouter(httpdelivery.Deps{
		Auth:          handler.NewAuthHandler(authSvc, cfg.CookieSecure),
		Hikes:         handler.NewHikeHandler(hikeSvc, cfg.MaxUploadMB<<20),
		Authenticator: authSvc,
		Static:        web.Dist(),
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func purgeSessions(ctx context.Context, svc *auth.Service) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := svc.PurgeExpiredSessions(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("purge expired sessions", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
