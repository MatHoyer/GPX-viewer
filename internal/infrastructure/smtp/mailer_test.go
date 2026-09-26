package smtp

import (
	"bufio"
	"context"
	"net"
	"strings"
	"testing"
)

// fakeServer accepts one SMTP session without TLS or auth and returns the
// commands and message data it received.
func fakeServer(t *testing.T) (port int, got <-chan string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	out := make(chan string, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		r := bufio.NewReader(conn)
		reply := func(s string) { _, _ = conn.Write([]byte(s + "\r\n")) }
		var log strings.Builder
		reply("220 fake ESMTP")
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				out <- log.String()
				return
			}
			log.WriteString(line)
			switch cmd := strings.ToUpper(strings.TrimSpace(line)); {
			case strings.HasPrefix(cmd, "EHLO"):
				reply("250 fake")
			case cmd == "DATA":
				reply("354 go ahead")
				for {
					l, err := r.ReadString('\n')
					if err != nil || l == ".\r\n" {
						break
					}
					log.WriteString(l)
				}
				reply("250 queued")
			case cmd == "QUIT":
				reply("221 bye")
				out <- log.String()
				return
			default:
				reply("250 ok")
			}
		}
	}()
	return ln.Addr().(*net.TCPAddr).Port, out
}

func TestSend(t *testing.T) {
	port, got := fakeServer(t)
	m, err := NewMailer(Config{Host: "127.0.0.1", Port: port, From: "GPX Viewer <noreply@gpx.test>"})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Send(context.Background(), "alice@example.com", "Confirm your émail", "line 1\nline 2\n"); err != nil {
		t.Fatal(err)
	}
	session := <-got
	for _, want := range []string{
		"MAIL FROM:<noreply@gpx.test>",
		"RCPT TO:<alice@example.com>",
		`From: "GPX Viewer" <noreply@gpx.test>`,
		"To: <alice@example.com>",
		"Subject: =?utf-8?q?Confirm_your_=C3=A9mail?=",
		"Content-Type: text/plain; charset=\"utf-8\"",
		"\r\n\r\nline 1\r\nline 2\r\n",
	} {
		if !strings.Contains(session, want) {
			t.Errorf("session missing %q:\n%s", want, session)
		}
	}
}

func TestSendRejectsBadRecipient(t *testing.T) {
	m, err := NewMailer(Config{Host: "127.0.0.1", Port: 1, From: "noreply@gpx.test"})
	if err != nil {
		t.Fatal(err)
	}
	if err := m.Send(context.Background(), "a@b.co\r\nBcc: x@y.z", "s", "b"); err == nil {
		t.Error("expected error for header injection in recipient")
	}
}

func TestNewMailerRejectsBadFrom(t *testing.T) {
	if _, err := NewMailer(Config{Host: "h", Port: 25, From: "not an address"}); err == nil {
		t.Error("expected error")
	}
}
