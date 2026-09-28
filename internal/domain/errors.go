package domain

import "errors"

var (
	ErrNotFound           = errors.New("not found")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidGPX         = errors.New("invalid gpx file")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrConflict           = errors.New("conflict")
	ErrEmailNotVerified   = errors.New("email not verified")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrRegistrationClosed = errors.New("registration closed")
)

// BannedError refuses to sign in a user an admin banned.
type BannedError struct {
	Reason string
}

func (e *BannedError) Error() string {
	return "account banned: " + e.Reason
}

// ValidationError reports invalid user input.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
