package config

import (
	"net/netip"
	"testing"
)

func TestLoadProxies(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("REAL_IP_HEADER", "cf-connecting-ip")
	t.Setenv("TRUSTED_PROXIES", " 10.42.0.0/16 , 192.168.1.7,::1 ")
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	want := []netip.Prefix{
		netip.MustParsePrefix("10.42.0.0/16"),
		netip.MustParsePrefix("192.168.1.7/32"),
		netip.MustParsePrefix("::1/128"),
	}
	if c.RealIPHeader != "Cf-Connecting-Ip" || len(c.TrustedProxies) != len(want) {
		t.Fatalf("header %q, proxies %v", c.RealIPHeader, c.TrustedProxies)
	}
	for i := range want {
		if c.TrustedProxies[i] != want[i] {
			t.Errorf("proxy %d = %v, want %v", i, c.TrustedProxies[i], want[i])
		}
	}
}

func TestLoadRejects(t *testing.T) {
	for name, env := range map[string]map[string]string{
		"header without proxies": {"REAL_IP_HEADER": "X-Forwarded-For"},
		"bad proxy":              {"REAL_IP_HEADER": "X-Forwarded-For", "TRUSTED_PROXIES": "10.0.0.0/33"},
		"smtp without from":      {"SMTP_HOST": "mail.example.com"},
	} {
		t.Run(name, func(t *testing.T) {
			t.Setenv("DATABASE_URL", "postgres://x")
			for k, v := range env {
				t.Setenv(k, v)
			}
			if _, err := Load(); err == nil {
				t.Error("expected an error")
			}
		})
	}
}

func TestLoadWithoutSMTP(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SMTP_HOST", "")
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.SMTP != nil || c.RealIPHeader != "" || c.TrustedProxies != nil {
		t.Errorf("config = %+v", c)
	}
}
