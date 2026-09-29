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
	// ErrEmailDisabled means no mail server is configured.
	ErrEmailDisabled = errors.New("email is not configured")
)

// BannedError refuses to sign in a user an admin banned.
type BannedError struct {
	Reason string
}

func (e *BannedError) Error() string {
	return "account banned: " + e.Reason
}

// ValidationError reports invalid user input. Code names the problem for
// clients that show it in the user's language, with Params filling it in.
type ValidationError struct {
	Field   string
	Message string
	Code    string
	Params  map[string]any
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}
