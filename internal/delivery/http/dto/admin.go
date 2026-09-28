package dto

import (
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

// Config is what the app tells every visitor about the instance.
type Config struct {
	// RegistrationEnabled mirrors REGISTRATION_ENABLED.
	RegistrationEnabled bool `json:"registrationEnabled"`
	// RegistrationOpen is whether the sign-up form accepts accounts: when
	// registration is enabled, or before the first account exists.
	RegistrationOpen bool `json:"registrationOpen"`
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
