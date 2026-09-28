package config

import (
	"fmt"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port         string
	DatabaseURL  string
	CookieSecure bool
	SessionTTL   time.Duration
	MaxUploadMB  int64
	// RegistrationEnabled lets anyone create an account. When false, only
	// the first account can sign up and admins invite the others.
	RegistrationEnabled bool
	// RealIPHeader names the header a reverse proxy sets to the client's IP,
	// e.g. CF-Connecting-IP or X-Forwarded-For. Empty trusts no header.
	RealIPHeader string
	// TrustedProxies are the peers allowed to set RealIPHeader.
	TrustedProxies []netip.Prefix
	// AppURL is the public base URL, used in links sent by email.
	AppURL string
	// SMTP is nil when no mail server is configured: accounts then sign in
	// without verifying their email, and nothing is emailed.
	SMTP *SMTP
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
		Port:                getenv("PORT", "8080"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		SessionTTL:          30 * 24 * time.Hour,
		MaxUploadMB:         20,
		RegistrationEnabled: true,
	}
	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	c.AppURL = getenv("APP_URL", "http://localhost:"+c.Port)
	if u, err := url.Parse(c.AppURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, fmt.Errorf("APP_URL must be an absolute http(s) URL")
	}
	if host := os.Getenv("SMTP_HOST"); host != "" {
		c.SMTP = &SMTP{
			Host:     host,
			Port:     587,
			Username: os.Getenv("SMTP_USERNAME"),
			Password: os.Getenv("SMTP_PASSWORD"),
			From:     os.Getenv("SMTP_FROM"),
		}
		if c.SMTP.From == "" {
			return nil, fmt.Errorf("SMTP_FROM is required with SMTP_HOST")
		}
		if v := os.Getenv("SMTP_PORT"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n <= 0 || n > 65535 {
				return nil, fmt.Errorf("SMTP_PORT must be a valid port")
			}
			c.SMTP.Port = n
		}
	}
	c.RealIPHeader = http.CanonicalHeaderKey(strings.TrimSpace(os.Getenv("REAL_IP_HEADER")))
	for _, v := range strings.Split(os.Getenv("TRUSTED_PROXIES"), ",") {
		if v = strings.TrimSpace(v); v == "" {
			continue
		}
		p, err := parsePrefix(v)
		if err != nil {
			return nil, fmt.Errorf("TRUSTED_PROXIES: %q is not an IP or CIDR", v)
		}
		c.TrustedProxies = append(c.TrustedProxies, p)
	}
	if c.RealIPHeader != "" && len(c.TrustedProxies) == 0 {
		return nil, fmt.Errorf("REAL_IP_HEADER needs TRUSTED_PROXIES, or any client could pick its IP")
	}
	if v := os.Getenv("COOKIE_SECURE"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("COOKIE_SECURE: %w", err)
		}
		c.CookieSecure = b
	}
	if v := os.Getenv("REGISTRATION_ENABLED"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return nil, fmt.Errorf("REGISTRATION_ENABLED: %w", err)
		}
		c.RegistrationEnabled = b
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

// parsePrefix reads a CIDR, or a single IP as a one-address prefix.
func parsePrefix(s string) (netip.Prefix, error) {
	if strings.Contains(s, "/") {
		p, err := netip.ParsePrefix(s)
		return p.Masked(), err
	}
	a, err := netip.ParseAddr(s)
	if err != nil {
		return netip.Prefix{}, err
	}
	return netip.PrefixFrom(a.Unmap(), a.Unmap().BitLen()), nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
