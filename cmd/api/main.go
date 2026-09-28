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
	"github.com/MatHoyer/gpx-viewer/internal/domain"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/gpx"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/ogimage"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/overpass"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/postgres"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/security"
	"github.com/MatHoyer/gpx-viewer/internal/infrastructure/smtp"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/account"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/admin"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/auth"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/hike"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/interaction"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/social"
	"github.com/MatHoyer/gpx-viewer/internal/usecase/summit"
	"github.com/MatHoyer/gpx-viewer/web"
)

func main() {
	run := run
	if len(os.Args) > 1 && os.Args[1] == "import-peaks" {
		run = func() error { return importPeaks(os.Args[2:]) }
	}
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

	// Without SMTP, accounts sign in unverified and admins hand out links.
	var mailer domain.Mailer
	if cfg.SMTP != nil {
		m, err := smtp.NewMailer(smtp.Config(*cfg.SMTP))
		if err != nil {
			return err
		}
		mailer = m
	} else {
		slog.Info("SMTP not configured: emails are not verified and no email is sent")
	}

	users := postgres.NewUserRepository(db)
	sessions := postgres.NewSessionRepository(db)
	authSvc, err := auth.NewService(
		users,
		sessions,
		postgres.NewEmailVerificationRepository(db),
		postgres.NewPasswordResetRepository(db),
		security.NewBcryptHasher(0),
		mailer,
		cfg.SessionTTL,
		cfg.AppURL,
		cfg.RegistrationEnabled,
	)
	if err != nil {
		return err
	}
	adminSvc := admin.NewService(users, sessions, authSvc)
	accountSvc := account.NewService(users)
	socialSvc := social.NewService(users, postgres.NewFriendshipRepository(db))
	hikeSvc := hike.NewService(postgres.NewHikeRepository(db), gpx.NewParser(), socialSvc)
	interactionSvc := interaction.NewService(postgres.NewInteractionRepository(db), hikeSvc)
	summitSvc := summit.NewService(postgres.NewPeakRepository(db), overpass.NewClient(overpass.DefaultURL), hikeSvc)

	go purgeExpired(ctx, authSvc)
	go refreshDerived(ctx, hikeSvc)

	router := httpdelivery.NewRouter(httpdelivery.Deps{
		Auth:           handler.NewAuthHandler(authSvc, cfg.CookieSecure),
		Account:        handler.NewAccountHandler(accountSvc),
		Hikes:          handler.NewHikeHandler(hikeSvc, interactionSvc, ogimage.Render, cfg.MaxUploadMB<<20),
		Social:         handler.NewSocialHandler(socialSvc),
		Summits:        handler.NewSummitHandler(summitSvc),
		Interactions:   handler.NewInteractionHandler(interactionSvc),
		Admin:          handler.NewAdminHandler(adminSvc, authSvc),
		Authenticator:  authSvc,
		Static:         web.Dist(),
		AppURL:         cfg.AppURL,
		HikeMeta:       hikeSvc,
		RealIPHeader:   cfg.RealIPHeader,
		TrustedProxies: cfg.TrustedProxies,
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

// refreshDerived backfills statistics of hikes imported by an older version.
func refreshDerived(ctx context.Context, svc *hike.Service) {
	n, err := svc.RefreshDerived(ctx)
	if err != nil && ctx.Err() == nil {
		slog.Warn("refresh derived hike stats", "err", err)
	}
	if n > 0 {
		slog.Info("refreshed derived hike stats", "hikes", n)
	}
}

func purgeExpired(ctx context.Context, svc *auth.Service) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := svc.PurgeExpired(ctx); err != nil && ctx.Err() == nil {
			slog.Warn("purge expired sessions and verifications", "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
