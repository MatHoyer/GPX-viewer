package postgres

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open connects to Postgres, retrying while the database starts up.
func Open(ctx context.Context, dsn string) (*gorm.DB, error) {
	cfg := &gorm.Config{
		TranslateError: true,
		Logger:         logger.Default.LogMode(logger.Warn),
	}
	var lastErr error
	for attempt := 1; attempt <= 10; attempt++ {
		db, err := gorm.Open(postgres.Open(dsn), cfg)
		if err == nil {
			sqlDB, err := db.DB()
			if err == nil {
				if err = sqlDB.PingContext(ctx); err == nil {
					return db, nil
				}
			}
			lastErr = err
		} else {
			lastErr = err
		}
		slog.Warn("database not ready, retrying", "attempt", attempt, "err", lastErr)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return nil, fmt.Errorf("connect to database: %w", lastErr)
}

// Migrate enables PostGIS and auto-migrates all models.
func Migrate(db *gorm.DB) error {
	if err := db.Exec("CREATE EXTENSION IF NOT EXISTS postgis").Error; err != nil {
		return fmt.Errorf("enable postgis: %w", err)
	}
	if err := db.AutoMigrate(&UserModel{}, &SessionModel{}, &EmailVerificationModel{}, &PasswordResetModel{}, &HikeModel{}, &FriendshipModel{}, &HikeParticipantModel{}, &HikeLabelModel{}, &HikeBestEffortModel{}, &HikeTileModel{}, &PeakModel{}, &HikeKudosModel{}, &HikeCommentModel{}); err != nil {
		return err
	}
	// One friendship per pair, whichever side sent the request.
	if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair
		ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))`).Error; err != nil {
		return err
	}
	// The oldest account administers the instance until someone else is
	// promoted; this also covers databases from before admins existed.
	if err := db.Exec(`UPDATE users SET is_admin = true
		WHERE id = (SELECT id FROM users ORDER BY created_at, id LIMIT 1)
		AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin)`).Error; err != nil {
		return err
	}
	// Leftovers from uploaded profile pictures, replaced by generated blobatars.
	if err := db.Exec("DROP TABLE IF EXISTS user_avatars").Error; err != nil {
		return err
	}
	return db.Exec("ALTER TABLE users DROP COLUMN IF EXISTS avatar_updated_at").Error
}
