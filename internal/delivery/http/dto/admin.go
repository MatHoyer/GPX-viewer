package dto

import (
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Config is what the app tells every visitor about the instance.
type Config struct {
	// RegistrationEnabled mirrors REGISTRATION_ENABLED.
	RegistrationEnabled bool `json:"registrationEnabled"`
	// RegistrationOpen is whether the sign-up form accepts accounts: when
	// registration is enabled, or before the first account exists.
	RegistrationOpen bool `json:"registrationOpen"`
	// EmailEnabled is false without a mail server: emails need no
	// verification and admins hand out password links.
	EmailEnabled bool `json:"emailEnabled"`
}

// AdminUser is a user as listed in the admin panel.
type AdminUser struct {
	ID              string     `json:"id"`
	Email           string     `json:"email"`
	Name            string     `json:"name"`
	IsAdmin         bool       `json:"isAdmin"`
	EmailVerifiedAt *time.Time `json:"emailVerifiedAt"`
	BannedAt        *time.Time `json:"bannedAt"`
	BanReason       string     `json:"banReason"`
	InvitedAt       *time.Time `json:"invitedAt"`
	Hikes           int64      `json:"hikes"`
	LastSeenAt      *time.Time `json:"lastSeenAt"`
	CreatedAt       time.Time  `json:"createdAt"`
}

func NewAdminUser(u *domain.AdminUser) AdminUser {
	return AdminUser{
		ID:              u.ID.String(),
		Email:           u.Email,
		Name:            u.Name,
		IsAdmin:         u.IsAdmin,
		EmailVerifiedAt: u.EmailVerifiedAt,
		BannedAt:        u.BannedAt,
		BanReason:       u.BanReason,
		InvitedAt:       u.InvitedAt,
		Hikes:           u.Hikes,
		LastSeenAt:      u.LastSeenAt,
		CreatedAt:       u.CreatedAt,
	}
}

func NewAdminUsers(us []domain.AdminUser) []AdminUser {
	out := make([]AdminUser, len(us))
	for i := range us {
		out[i] = NewAdminUser(&us[i])
	}
	return out
}

// UserPage is one page of the admin user list.
type UserPage struct {
	Users    []AdminUser `json:"users"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

// Session is a signed-in device.
type Session struct {
	ID         string    `json:"id"`
	UserAgent  string    `json:"userAgent"`
	IP         string    `json:"ip"`
	CreatedAt  time.Time `json:"createdAt"`
	LastUsedAt time.Time `json:"lastUsedAt"`
	ExpiresAt  time.Time `json:"expiresAt"`
	// Current marks the session making the request.
	Current bool `json:"current"`
}

// NewSessions converts sessions, marking current (uuid.Nil for none).
func NewSessions(ss []domain.Session, current uuid.UUID) []Session {
	out := make([]Session, len(ss))
	for i, s := range ss {
		out[i] = Session{
			ID:         s.ID.String(),
			UserAgent:  s.UserAgent,
			IP:         s.IP,
			CreatedAt:  s.CreatedAt,
			LastUsedAt: s.LastUsedAt,
			ExpiresAt:  s.ExpiresAt,
			Current:    current != uuid.Nil && s.ID == current,
		}
	}
	return out
}

type CreateUser struct {
	Email     string `json:"email"`
	Name      string `json:"name"`
	SendEmail bool   `json:"sendEmail"`
}

type SendInvite struct {
	SendEmail bool `json:"sendEmail"`
}

// Invite is the link where an invited user chooses their password.
type Invite struct {
	Link string `json:"inviteLink"`
	// EmailSent is false when no email was asked for or it could not be sent.
	EmailSent bool `json:"emailSent"`
}

type CreatedUser struct {
	User AdminUser `json:"user"`
	Invite
}

type BanUser struct {
	Reason string `json:"reason"`
}
