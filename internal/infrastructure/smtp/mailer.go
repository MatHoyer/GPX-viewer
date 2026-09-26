// Package smtp sends emails through an SMTP server.
package smtp

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

const timeout = 30 * time.Second

type Config struct {
	Host     string
	Port     int
	Username string
	Password string
	// From is the sender address, optionally with a display name.
	From string
}

type Mailer struct {
	cfg  Config
	from *mail.Address
}

func NewMailer(cfg Config) (*Mailer, error) {
	from, err := mail.ParseAddress(cfg.From)
	if err != nil {
		return nil, fmt.Errorf("smtp from address: %w", err)
	}
	return &Mailer{cfg: cfg, from: from}, nil
}

// Send delivers a plain-text email. Port 465 uses implicit TLS; other ports
// upgrade with STARTTLS when the server offers it. Credentials are never sent
// over an unencrypted connection, except to localhost.
func (m *Mailer) Send(ctx context.Context, to, subject, body string) error {
	rcpt, err := mail.ParseAddress(to)
	if err != nil {
		return fmt.Errorf("recipient: %w", err)
	}
	msg, err := m.message(rcpt, subject, body)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	c, err := m.dial(ctx)
	if err != nil {
		return err
	}
	defer c.Close()

	if err := c.Hello("localhost"); err != nil {
		return err
	}
	if m.cfg.Port != 465 {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: m.cfg.Host}); err != nil {
				return fmt.Errorf("starttls: %w", err)
			}
		}
	}
	if m.cfg.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(m.from.Address); err != nil {
		return err
	}
	if err := c.Rcpt(rcpt.Address); err != nil {
		return err
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(msg); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

func (m *Mailer) dial(ctx context.Context) (*smtp.Client, error) {
	addr := net.JoinHostPort(m.cfg.Host, strconv.Itoa(m.cfg.Port))
	var conn net.Conn
	var err error
	if m.cfg.Port == 465 {
		d := &tls.Dialer{Config: &tls.Config{ServerName: m.cfg.Host}}
		conn, err = d.DialContext(ctx, "tcp", addr)
	} else {
		var d net.Dialer
		conn, err = d.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return nil, fmt.Errorf("smtp dial: %w", err)
	}
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetDeadline(deadline)
	}
	c, err := smtp.NewClient(conn, m.cfg.Host)
	if err != nil {
		conn.Close()
		return nil, err
	}
	return c, nil
}

func (m *Mailer) message(to *mail.Address, subject, body string) ([]byte, error) {
	id, err := messageID(m.from.Address)
	if err != nil {
		return nil, err
	}
	var b bytes.Buffer
	header := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	header("From", m.from.String())
	header("To", to.String())
	header("Subject", mime.QEncoding.Encode("utf-8", subject))
	header("Date", time.Now().Format(time.RFC1123Z))
	header("Message-ID", id)
	header("MIME-Version", "1.0")
	header("Content-Type", `text/plain; charset="utf-8"`)
	header("Content-Transfer-Encoding", "8bit")
	b.WriteString("\r\n")
	b.WriteString(strings.ReplaceAll(strings.ReplaceAll(body, "\r\n", "\n"), "\n", "\r\n"))
	return b.Bytes(), nil
}

func messageID(from string) (string, error) {
	r := make([]byte, 16)
	if _, err := rand.Read(r); err != nil {
		return "", err
	}
	domain := "localhost"
	if i := strings.LastIndexByte(from, '@'); i >= 0 {
		domain = from[i+1:]
	}
	return "<" + hex.EncodeToString(r) + "@" + domain + ">", nil
}
