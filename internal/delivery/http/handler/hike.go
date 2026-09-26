package handler

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const maxFilesPerUpload = 50

type HikeService interface {
	Import(ctx context.Context, userID uuid.UUID, filename string, data []byte) (*domain.Hike, error)
	List(ctx context.Context, userID uuid.UUID) ([]domain.Hike, error)
	Get(ctx context.Context, userID, id uuid.UUID) (*domain.Hike, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	Rename(ctx context.Context, userID, id uuid.UUID, name string) (*domain.Hike, error)
	Tracks(ctx context.Context, userID uuid.UUID) ([]domain.HikeTrack, error)
	Profile(ctx context.Context, userID, id uuid.UUID) (*domain.Profile, error)
}

type HikeHandler struct {
	svc         HikeService
	maxFileSize int64
}

func NewHikeHandler(svc HikeService, maxFileSize int64) *HikeHandler {
	return &HikeHandler{svc: svc, maxFileSize: maxFileSize}
}

// Upload imports every file in the multipart "files" field and reports per-file results.
func (h *HikeHandler) Upload(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	r.Body = http.MaxBytesReader(w, r.Body, h.maxFileSize*maxFilesPerUpload)

	mr, err := r.MultipartReader()
	if err != nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "expected multipart/form-data"})
		return
	}

	results := []dto.UploadResult{}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			writeJSON(w, http.StatusBadRequest, dto.Error{Error: "invalid multipart body"})
			return
		}
		if part.FormName() != "files" || part.FileName() == "" {
			part.Close()
			continue
		}
		if len(results) >= maxFilesPerUpload {
			part.Close()
			writeJSON(w, http.StatusBadRequest, dto.Error{Error: fmt.Sprintf("at most %d files per upload", maxFilesPerUpload)})
			return
		}

		res := dto.UploadResult{Filename: part.FileName()}
		data, err := io.ReadAll(io.LimitReader(part, h.maxFileSize+1))
		part.Close()
		switch {
		case err != nil:
			writeJSON(w, http.StatusBadRequest, dto.Error{Error: "failed to read upload"})
			return
		case int64(len(data)) > h.maxFileSize:
			res.Error = fmt.Sprintf("file exceeds %d MB", h.maxFileSize>>20)
		default:
			hike, err := h.svc.Import(r.Context(), user.ID, part.FileName(), data)
			if err != nil {
				if !errors.Is(err, domain.ErrInvalidGPX) {
					writeError(w, r, err)
					return
				}
				res.Error = "not a valid GPX file"
			} else {
				d := dto.NewHike(hike)
				res.Hike = &d
			}
		}
		results = append(results, res)
	}

	if len(results) == 0 {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "no files provided"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (h *HikeHandler) List(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	hikes, err := h.svc.List(r.Context(), user.ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	out := make([]dto.Hike, len(hikes))
	for i := range hikes {
		out[i] = dto.NewHike(&hikes[i])
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *HikeHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	hike, err := h.svc.Get(r.Context(), middleware.UserFrom(r.Context()).ID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewHike(hike))
}

func (h *HikeHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var in dto.UpdateHike
	if !decodeJSON(w, r, &in) {
		return
	}
	if in.Name == nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "nothing to update"})
		return
	}
	hike, err := h.svc.Rename(r.Context(), middleware.UserFrom(r.Context()).ID, id, *in.Name)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewHike(hike))
}

func (h *HikeHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), middleware.UserFrom(r.Context()).ID, id); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HikeHandler) Profile(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	p, err := h.svc.Profile(r.Context(), middleware.UserFrom(r.Context()).ID, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewProfile(p))
}

func (h *HikeHandler) Tracks(w http.ResponseWriter, r *http.Request) {
	tracks, err := h.svc.Tracks(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewFeatureCollection(tracks))
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeJSON(w, http.StatusNotFound, dto.Error{Error: "not found"})
		return uuid.Nil, false
	}
	return id, true
}
