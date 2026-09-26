package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port         string
	DatabaseURL  string
	CookieSecure bool
	SessionTTL   time.Duration
	MaxUploadMB  int64
	// AppURL is the public base URL, used in links sent by email.
	AppURL string
	SMTP   SMTP
}

type SMTP struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

func Load() (*Config, error) {
	c := &Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		SessionTTL:  30 * 24 * time.Hour,
		MaxUploadMB: 20,
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	c.AppURL = getenv("APP_URL", "http://localhost:"+c.Port)
	if u, err := url.Parse(c.AppURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, fmt.Errorf("APP_URL must be an absolute http(s) URL")
	}
	c.SMTP = SMTP{
		Host:     os.Getenv("SMTP_HOST"),
		Port:     587,
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		From:     os.Getenv("SMTP_FROM"),
	}
	if c.SMTP.Host == "" || c.SMTP.From == "" {
		return nil, fmt.Errorf("SMTP_HOST and SMTP_FROM are required")
	}
	if v := os.Getenv("SMTP_PORT"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 || n > 65535 {
			return nil, fmt.Errorf("SMTP_PORT must be a valid port")
		}
		c.SMTP.Port = n
	}
	if v := os.Getenv("COOKIE_SECURE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("COOKIE_SECURE: %w", err)
		}
		c.CookieSecure = b
	}
	if v := os.Getenv("MAX_UPLOAD_MB"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return nil, fmt.Errorf("MAX_UPLOAD_MB must be a positive integer")
		}
		c.MaxUploadMB = n
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
