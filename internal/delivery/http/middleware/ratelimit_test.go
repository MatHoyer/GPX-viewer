package middleware

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func echoBody(w http.ResponseWriter, r *http.Request) {
	b, _ := io.ReadAll(r.Body)
	_, _ = w.Write(b)
}

func post(h http.Handler, ip, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	r.RemoteAddr = ip + ":1234"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestLimiterByIP(t *testing.T) {
	h := NewLimiter(2, 15*time.Minute, "reset requests").ByIP(http.HandlerFunc(echoBody))

	for i := range 2 {
		if w := post(h, "1.2.3.4", ""); w.Code != http.StatusOK {
			t.Fatalf("request %d: %d", i, w.Code)
		}
	}
	w := post(h, "1.2.3.4", "")
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("over limit: %d", w.Code)
	}
	if got := w.Header().Get("Retry-After"); got != "900" {
		t.Errorf("Retry-After = %q", got)
	}
	var body struct {
		Error      string `json:"error"`
		RetryAfter int    `json:"retryAfter"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Error != "Too many reset requests. Try again in 15 minutes." || body.RetryAfter != 900 {
		t.Errorf("body = %+v", body)
	}

	if w := post(h, "5.6.7.8", ""); w.Code != http.StatusOK {
		t.Errorf("other IP: %d", w.Code)
	}
}

// Rotating addresses inside one IPv6 /64 must not buy a fresh budget.
func TestLimiterByIPv6Prefix(t *testing.T) {
	h := NewLimiter(1, time.Minute, "attempts").ByIP(http.HandlerFunc(echoBody))
	if w := post(h, "[2001:db8::1]", ""); w.Code != http.StatusOK {
		t.Fatalf("first: %d", w.Code)
	}
	if w := post(h, "[2001:db8::2]", ""); w.Code != http.StatusTooManyRequests {
		t.Errorf("same /64: %d", w.Code)
	}
}

func TestLimiterByEmail(t *testing.T) {
	h := NewLimiter(1, time.Minute, "sign-in attempts").ByEmail(http.HandlerFunc(echoBody))

	body := `{"email":"a@b.co","password":"x"}`
	w := post(h, "1.1.1.1", body)
	if w.Code != http.StatusOK || w.Body.String() != body {
		t.Fatalf("first: %d %q (body must reach the handler)", w.Code, w.Body.String())
	}
	// Same account from another IP, differently spelled.
	if w := post(h, "2.2.2.2", `{"email":" A@B.co ","password":"x"}`); w.Code != http.StatusTooManyRequests {
		t.Errorf("same email: %d", w.Code)
	}
	if w := post(h, "1.1.1.1", `{"email":"c@b.co","password":"x"}`); w.Code != http.StatusOK {
		t.Errorf("other email: %d", w.Code)
	}
	for range 2 {
		if w := post(h, "1.1.1.1", `not json`); w.Code != http.StatusOK {
			t.Errorf("no email is not counted: %d", w.Code)
		}
	}
}

func TestLimiterByUser(t *testing.T) {
	h := NewLimiter(1, time.Minute, "attempts").ByUser(http.HandlerFunc(echoBody))
	as := func(id uuid.UUID) int {
		r := httptest.NewRequest(http.MethodPost, "/", nil)
		r = r.WithContext(context.WithValue(r.Context(), ctxKey{}, &domain.User{ID: id}))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	alice, bob := uuid.New(), uuid.New()
	if code := as(alice); code != http.StatusOK {
		t.Fatalf("first: %d", code)
	}
	if code := as(alice); code != http.StatusTooManyRequests {
		t.Errorf("second: %d", code)
	}
	if code := as(bob); code != http.StatusOK {
		t.Errorf("other user: %d", code)
	}
}

func TestHumanize(t *testing.T) {
	for d, want := range map[time.Duration]string{
		time.Minute:      "1 minute",
		15 * time.Minute: "15 minutes",
		time.Hour:        "1 hour",
		90 * time.Second: "90 seconds",
	} {
		if got := humanize(d); got != want {
			t.Errorf("humanize(%v) = %q, want %q", d, got, want)
		}
	}
}
