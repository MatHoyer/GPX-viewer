package handler

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"strings"
	"time"
	"unicode"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/dto"
	"github.com/MatHoyer/gpx-viewer/internal/delivery/http/middleware"
	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const maxFilesPerUpload = 50

type HikeService interface {
	Import(ctx context.Context, userID uuid.UUID, filename string, data []byte) (*domain.Hike, error)
	ImportPlanned(ctx context.Context, userID uuid.UUID, filename string, data []byte) (*domain.Hike, error)
	List(ctx context.Context, viewer, owner uuid.UUID) ([]domain.Hike, error)
	Get(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	Update(ctx context.Context, userID, id uuid.UUID, u domain.HikeUpdate) (*domain.Hike, error)
	MarkDone(ctx context.Context, userID, id uuid.UUID, data []byte) (*domain.Hike, error)
	Labels(ctx context.Context, userID uuid.UUID) ([]string, error)
	Tracks(ctx context.Context, viewer, owner uuid.UUID) ([]domain.HikeTrack, error)
	Tiles(ctx context.Context, viewer, owner uuid.UUID) (map[uuid.UUID][]domain.Tile, error)
	Similar(ctx context.Context, viewer, id uuid.UUID) ([]domain.Hike, error)
	Feed(ctx context.Context, userID uuid.UUID, after *domain.FeedCursor) ([]domain.Hike, *domain.FeedCursor, error)
	Card(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, []domain.Segment, error)
	Profile(ctx context.Context, viewer, id uuid.UUID) (*domain.Profile, error)
	GPX(ctx context.Context, viewer, id uuid.UUID) (*domain.Hike, []byte, error)
	Export(ctx context.Context, userID uuid.UUID, fn func(h *domain.Hike, raw []byte) error) error
	Tag(ctx context.Context, owner, id, friend uuid.UUID) error
	Untag(ctx context.Context, viewer, id, participant uuid.UUID) error
}

// InteractionCounts sums up kudos and comments for the hikes a response shows.
type InteractionCounts interface {
	Counts(ctx context.Context, viewer uuid.UUID, hikeIDs []uuid.UUID) (map[uuid.UUID]domain.HikeInteractions, error)
}

// CardRenderer draws a hike's link preview image as PNG.
type CardRenderer func(h *domain.Hike, track []domain.Segment) ([]byte, error)

type HikeHandler struct {
	svc          HikeService
	interactions InteractionCounts
	renderCard   CardRenderer
	maxFileSize  int64
}

// NewHikeHandler builds the hike endpoints. interactions may be nil, leaving
// kudos and comment counts out of responses; renderCard may be nil when
// preview images are not served.
func NewHikeHandler(svc HikeService, interactions InteractionCounts, renderCard CardRenderer, maxFileSize int64) *HikeHandler {
	return &HikeHandler{svc: svc, interactions: interactions, renderCard: renderCard, maxFileSize: maxFileSize}
}

// withInteractions adds kudos and comment counts to hikes in a response.
func (h *HikeHandler) withInteractions(ctx context.Context, viewer uuid.UUID, hikes []dto.Hike) error {
	if h.interactions == nil || len(hikes) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(hikes))
	for i, hk := range hikes {
		ids[i] = uuid.MustParse(hk.ID)
	}
	counts, err := h.interactions.Counts(ctx, viewer, ids)
	if err != nil {
		return err
	}
	for i := range hikes {
		hikes[i].Interactions = dto.NewHikeInteractions(counts[ids[i]])
	}
	return nil
}

// Upload imports every file in the multipart "files" field and reports per-file
// results. With ?planned=true the files are routes to do rather than hikes done.
func (h *HikeHandler) Upload(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	importFile := h.svc.Import
	if r.URL.Query().Get("planned") == "true" {
		importFile = h.svc.ImportPlanned
	}
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
			hike, err := importFile(r.Context(), user.ID, part.FileName(), data)
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

// List returns the signed-in user's hikes.
func (h *HikeHandler) List(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, middleware.UserFrom(r.Context()).ID)
}

// UserList returns the hikes of the user in the URL, if the viewer may see them.
func (h *HikeHandler) UserList(w http.ResponseWriter, r *http.Request) {
	if owner, ok := parseID(w, r); ok {
		h.list(w, r, owner)
	}
}

func (h *HikeHandler) list(w http.ResponseWriter, r *http.Request, owner uuid.UUID) {
	hikes, err := h.svc.List(r.Context(), middleware.ViewerID(r.Context()), owner)
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
	viewer := middleware.ViewerID(r.Context())
	hike, err := h.svc.Get(r.Context(), viewer, id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	out := []dto.Hike{dto.NewHike(hike)}
	if err := h.withInteractions(r.Context(), viewer, out); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, out[0])
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
	if in.Name == nil && in.Notes == nil && in.Labels == nil {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "nothing to update"})
		return
	}
	u := domain.HikeUpdate{Name: in.Name, Notes: in.Notes, Labels: in.Labels}
	hike, err := h.svc.Update(r.Context(), middleware.UserFrom(r.Context()).ID, id, u)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewHike(hike))
}

// MarkDone marks a planned hike as walked. An optional multipart "file" holds
// the GPX recorded on the walk, which replaces the planned route.
func (h *HikeHandler) MarkDone(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var data []byte
	if ct, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); ct == "multipart/form-data" {
		r.Body = http.MaxBytesReader(w, r.Body, h.maxFileSize+1<<20)
		file, _, err := r.FormFile("file")
		switch {
		case errors.Is(err, http.ErrMissingFile):
		case err != nil:
			writeJSON(w, http.StatusBadRequest, dto.Error{Error: "invalid multipart body"})
			return
		default:
			data, err = io.ReadAll(io.LimitReader(file, h.maxFileSize+1))
			file.Close()
			if err != nil {
				writeJSON(w, http.StatusBadRequest, dto.Error{Error: "failed to read upload"})
				return
			}
			if int64(len(data)) > h.maxFileSize {
				writeJSON(w, http.StatusBadRequest, dto.Error{Error: fmt.Sprintf("file exceeds %d MB", h.maxFileSize>>20)})
				return
			}
		}
	}
	hike, err := h.svc.MarkDone(r.Context(), middleware.UserFrom(r.Context()).ID, id, data)
	if errors.Is(err, domain.ErrInvalidGPX) {
		writeJSON(w, http.StatusBadRequest, dto.Error{Error: "not a valid GPX file"})
		return
	}
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
	p, err := h.svc.Profile(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewProfile(p))
}

// GPX downloads the hike's original GPX file.
func (h *HikeHandler) GPX(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	hike, raw, err := h.svc.GPX(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/gpx+xml")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": gpxFilename(hike.Name)}))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(raw)
}

// gpxFilename turns a hike name into a safe download filename.
func gpxFilename(name string) string {
	clean := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || strings.ContainsRune(`/\:*?"<>|`, r) {
			return '_'
		}
		return r
	}, strings.TrimSpace(name))
	if clean == "" {
		clean = "hike"
	}
	return clean + ".gpx"
}

// Export downloads a zip of the original GPX files of every hike the
// signed-in user owns. Hikes are read one at a time and streamed, so an
// error after the first file can only abort the download.
func (h *HikeHandler) Export(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context())
	name := "hikes-" + time.Now().UTC().Format(time.DateOnly) + ".zip"
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))

	zw := zip.NewWriter(w)
	names := exportNames{}
	err := h.svc.Export(r.Context(), user.ID, func(hike *domain.Hike, raw []byte) error {
		modified := hike.CreatedAt
		if hike.StartedAt != nil {
			modified = *hike.StartedAt
		}
		f, err := zw.CreateHeader(&zip.FileHeader{Name: names.next(hike), Method: zip.Deflate, Modified: modified})
		if err != nil {
			return err
		}
		_, err = f.Write(raw)
		return err
	})
	if err == nil {
		err = zw.Close()
	}
	if err != nil && r.Context().Err() == nil {
		slog.Error("export hikes", "user", user.ID, "err", err)
		// Headers are sent; dropping the connection keeps a truncated zip
		// from looking like a complete download.
		panic(http.ErrAbortHandler)
	}
}

// exportNames names files in an export after the hike's date and name,
// numbering repeats so no file overwrites another.
type exportNames map[string]bool

func (used exportNames) next(h *domain.Hike) string {
	base := strings.TrimSuffix(gpxFilename(h.Name), ".gpx")
	if h.StartedAt != nil {
		base = h.StartedAt.Format(time.DateOnly) + " " + base
	}
	name := base + ".gpx"
	for i := 2; used[name]; i++ {
		name = fmt.Sprintf("%s (%d).gpx", base, i)
	}
	used[name] = true
	return name
}

// Labels returns the labels the signed-in user has put on their hikes.
func (h *HikeHandler) Labels(w http.ResponseWriter, r *http.Request) {
	labels, err := h.svc.Labels(r.Context(), middleware.UserFrom(r.Context()).ID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	if labels == nil {
		labels = []string{}
	}
	writeJSON(w, http.StatusOK, labels)
}

// Feed returns a page of friends' recent hikes. `after` is the `next` cursor of
// the previous page.
func (h *HikeHandler) Feed(w http.ResponseWriter, r *http.Request) {
	var after *domain.FeedCursor
	if c := r.URL.Query().Get("after"); c != "" {
		cur, err := dto.ParseFeedCursor(c)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, dto.Error{Error: "invalid cursor", Field: "after"})
			return
		}
		after = cur
	}
	user := middleware.UserFrom(r.Context()).ID
	hikes, next, err := h.svc.Feed(r.Context(), user, after)
	if err != nil {
		writeError(w, r, err)
		return
	}
	feed := dto.NewFeed(hikes, next)
	if err := h.withInteractions(r.Context(), user, feed.Hikes); err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, feed)
}

// Card serves the hike's link preview image, for whoever may see the hike.
func (h *HikeHandler) Card(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if h.renderCard == nil {
		writeJSON(w, http.StatusNotFound, dto.Error{Error: "not found"})
		return
	}
	hike, track, err := h.svc.Card(r.Context(), middleware.ViewerID(r.Context()), id)
	if err != nil {
		writeError(w, r, err)
		return
	}
	png, err := h.renderCard(hike, track)
	if err != nil {
		writeError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	// Previews are fetched by link unfurlers; an hour keeps renames showing up soon.
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write(png)
}

// Similar returns the signed-in user's other hikes along the same route.
func (h *HikeHandler) Similar(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	hikes, err := h.svc.Similar(r.Context(), middleware.UserFrom(r.Context()).ID, id)
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

// Tiles returns the zoom-14 tiles each of the signed-in user's hikes passes through.
func (h *HikeHandler) Tiles(w http.ResponseWriter, r *http.Request) {
	user := middleware.UserFrom(r.Context()).ID
	tiles, err := h.svc.Tiles(r.Context(), user, user)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewHikeTiles(tiles))
}

// Tracks returns the signed-in user's simplified hike geometries.
func (h *HikeHandler) Tracks(w http.ResponseWriter, r *http.Request) {
	h.tracks(w, r, middleware.UserFrom(r.Context()).ID)
}

// UserTracks returns the tracks of the user in the URL, if the viewer may see them.
func (h *HikeHandler) UserTracks(w http.ResponseWriter, r *http.Request) {
	if owner, ok := parseID(w, r); ok {
		h.tracks(w, r, owner)
	}
}

func (h *HikeHandler) tracks(w http.ResponseWriter, r *http.Request, owner uuid.UUID) {
	tracks, err := h.svc.Tracks(r.Context(), middleware.ViewerID(r.Context()), owner)
	if err != nil {
		writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, dto.NewFeatureCollection(tracks))
}

// Tag adds the friend in the URL to the hike.
func (h *HikeHandler) Tag(w http.ResponseWriter, r *http.Request) {
	h.participant(w, r, h.svc.Tag)
}

// Untag removes the participant in the URL from the hike.
func (h *HikeHandler) Untag(w http.ResponseWriter, r *http.Request) {
	h.participant(w, r, h.svc.Untag)
}

func (h *HikeHandler) participant(w http.ResponseWriter, r *http.Request, action func(ctx context.Context, viewer, id, user uuid.UUID) error) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	user, ok := parseParam(w, r, "userId")
	if !ok {
		return
	}
	if err := action(r.Context(), middleware.UserFrom(r.Context()).ID, id, user); err != nil {
		writeError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	return parseParam(w, r, "id")
}

func parseParam(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeJSON(w, http.StatusNotFound, dto.Error{Error: "not found"})
		return uuid.Nil, false
	}
	return id, true
}
