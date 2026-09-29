package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var ve *domain.ValidationError
	var be *domain.BannedError
	switch {
	case errors.As(err, &ve):
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: ve.Message, Field: ve.Field, Code: ve.Code, Params: ve.Params})
	case errors.As(err, &be):
		writeJSON(w, http.StatusForbidden, dto.Error{Error: "your account was suspended: " + be.Reason, Code: "banned", Reason: be.Reason})
	case errors.Is(err, domain.ErrEmailDisabled):
		writeJSON(w, http.StatusServiceUnavailable, dto.Error{Error: "email is not set up here; ask an admin for a password link", Code: "email_disabled"})
	case errors.Is(err, domain.ErrRegistrationClosed):
		writeJSON(w, http.StatusForbidden, dto.Error{Error: "sign-up is closed; ask the admin for an invite", Code: "registration_closed"})
	case errors.Is(err, domain.ErrNotFound):
		writeJSON(w, http.StatusNotFound, dto.Error{Error: "not found", Code: "not_found"})
	case errors.Is(err, domain.ErrInvalidCredentials):
		writeJSON(w, http.StatusUnauthorized, dto.Error{Error: "invalid email or password", Code: "invalid_credentials"})
	case errors.Is(err, domain.ErrEmailNotVerified):
		writeJSON(w, http.StatusForbidden, dto.Error{Error: "email not verified", Field: "email", Code: "email_not_verified"})
	case errors.Is(err, domain.ErrInvalidToken):
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "this link is invalid or has expired", Code: "invalid_token"})
	case errors.Is(err, domain.ErrUnauthorized):
		writeJSON(w, http.StatusUnauthorized, dto.Error{Error: "unauthorized", Code: "unauthorized"})
	case errors.Is(err, domain.ErrEmailTaken):
		writeJSON(w, http.StatusConflict, dto.Error{Error: "email already registered", Field: "email", Code: "email_taken"})
	case errors.Is(err, domain.ErrConflict):
		writeJSON(w, http.StatusConflict, dto.Error{Error: "conflict", Code: "conflict"})
	case errors.Is(err, domain.ErrInvalidGPX):
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: err.Error(), Code: "invalid_gpx"})
	default:
		slog.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		writeJSON(w, http.StatusInternalServerError, dto.Error{Error: "internal server error", Code: "internal"})
	}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "invalid request body", Code: "invalid_body"})
		return false
	}
	return true
}
