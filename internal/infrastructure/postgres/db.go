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
	return db.AutoMigrate(&UserModel{}, &SessionModel{}, &HikeModel{})
}
