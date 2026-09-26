// Package ogimage draws the link preview card of a hike: its track and stats
// on a 1200×630 PNG, the size Open Graph and Twitter cards expect.
package ogimage

import (
	"bytes"
	"fmt"
	"image/color"
	"math"
	"strings"

	"github.com/fogleman/gg"
	"github.com/golang/freetype/truetype"
	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const (
	Width  = 1200
	Height = 630

	pad    = 56
	mapW   = 640 // left panel with the track
	panelX = mapW + 2*pad
)

var (
	background = color.RGBA{0xf7, 0xf6, 0xf2, 0xff}
	mapBG      = color.RGBA{0xe9, 0xee, 0xe6, 0xff}
	track      = color.RGBA{0xe4, 0x57, 0x2e, 0xff}
	ink        = color.RGBA{0x1c, 0x1c, 0x1a, 0xff}
	muted      = color.RGBA{0x6b, 0x6b, 0x66, 0xff}

	regular = mustParse(goregular.TTF)
	bold    = mustParse(gobold.TTF)
)

func mustParse(ttf []byte) *truetype.Font {
	f, err := truetype.Parse(ttf)
	if err != nil {
		panic(err)
	}
	return f
}

func face(f *truetype.Font, size float64) font.Face {
	return truetype.NewFace(f, &truetype.Options{Size: size, DPI: 72, Hinting: font.HintingFull})
}

// Render draws a hike's card. The owner's name is shown when h.Owner is set.
func Render(h *domain.Hike, segments []domain.Segment) ([]byte, error) {
	dc := gg.NewContext(Width, Height)
	dc.SetColor(background)
	dc.Clear()

	dc.SetColor(mapBG)
	dc.DrawRoundedRectangle(pad, pad, mapW, Height-2*pad, 24)
	dc.Fill()
	drawTrack(dc, segments, pad+40, pad+40, mapW-80, Height-2*pad-80)

	y := float64(pad + 20)
	dc.SetFontFace(face(bold, 22))
	dc.SetColor(track)
	dc.DrawString("GPX Viewer", panelX, y+22)
	y += 64

	dc.SetFontFace(face(bold, 46))
	dc.SetColor(ink)
	maxW := float64(Width - panelX - pad)
	lines := dc.WordWrap(h.Name, maxW)
	if len(lines) > 3 {
		// Cut the third line until it fits with an ellipsis.
		last := []rune(lines[2])
		for len(last) > 0 {
			if w, _ := dc.MeasureString(string(last) + "…"); w <= maxW {
				break
			}
			last = last[:len(last)-1]
		}
		lines = append(lines[:2], strings.TrimSpace(string(last))+"…")
	}
	for _, l := range lines {
		y += 52
		dc.DrawString(l, panelX, y)
	}

	dc.SetFontFace(face(regular, 24))
	dc.SetColor(muted)
	var sub string
	if h.StartedAt != nil {
		sub = h.StartedAt.Format("January 2, 2006")
	}
	if h.Owner != nil {
		if sub != "" {
			sub += " · "
		}
		sub += "by " + ownerName(h.Owner)
	}
	if sub != "" {
		y += 44
		dc.DrawString(sub, panelX, y)
	}

	stats := [][2]string{{"Distance", fmt.Sprintf("%.1f km", h.DistanceM/1000)}, {"Elevation gain", fmt.Sprintf("%d m", int(math.Round(h.ElevationGainM)))}}
	if h.DurationS > 0 {
		stats = append(stats, [2]string{"Duration", fmt.Sprintf("%dh%02d", h.DurationS/3600, (h.DurationS%3600)/60)})
	}
	y = Height - pad - float64(len(stats))*62 + 20
	for _, s := range stats {
		dc.SetFontFace(face(regular, 22))
		dc.SetColor(muted)
		dc.DrawString(s[0], panelX, y)
		dc.SetFontFace(face(bold, 34))
		dc.SetColor(ink)
		dc.DrawStringAnchored(s[1], Width-pad, y, 1, 0)
		y += 62
	}

	var buf bytes.Buffer
	if err := dc.EncodePNG(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func ownerName(u *domain.User) string {
	if u.Name != "" {
		return u.Name
	}
	return "a hiker"
}

// drawTrack fits the segments into the box in web mercator, keeping their shape.
func drawTrack(dc *gg.Context, segments []domain.Segment, x, y, w, hgt float64) {
	var pts [][]gg.Point
	minX, minY, maxX, maxY := math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)
	for _, seg := range segments {
		line := make([]gg.Point, len(seg))
		for i, p := range seg {
			px, py := mercator(p.Lon, p.Lat)
			line[i] = gg.Point{X: px, Y: py}
			minX, maxX = math.Min(minX, px), math.Max(maxX, px)
			minY, maxY = math.Min(minY, py), math.Max(maxY, py)
		}
		pts = append(pts, line)
	}
	if len(pts) == 0 {
		return
	}
	scale := math.Min(w/math.Max(maxX-minX, 1e-9), hgt/math.Max(maxY-minY, 1e-9))
	offX := x + (w-(maxX-minX)*scale)/2
	offY := y + (hgt-(maxY-minY)*scale)/2
	at := func(p gg.Point) (float64, float64) { return offX + (p.X-minX)*scale, offY + (p.Y-minY)*scale }

	dc.SetLineCapRound()
	dc.SetLineJoinRound()
	dc.SetColor(track)
	dc.SetLineWidth(7)
	for _, line := range pts {
		for i, p := range line {
			px, py := at(p)
			if i == 0 {
				dc.MoveTo(px, py)
			} else {
				dc.LineTo(px, py)
			}
		}
		dc.Stroke()
	}

	// Start as a green dot, finish as a dark one.
	first, last := pts[0][0], pts[len(pts)-1][len(pts[len(pts)-1])-1]
	for _, m := range []struct {
		p gg.Point
		c color.Color
	}{{first, color.RGBA{0x10, 0xb9, 0x81, 0xff}}, {last, ink}} {
		px, py := at(m.p)
		dc.SetColor(color.White)
		dc.DrawCircle(px, py, 12)
		dc.Fill()
		dc.SetColor(m.c)
		dc.DrawCircle(px, py, 8)
		dc.Fill()
	}
}

// mercator projects to web mercator units, y growing south like the image.
func mercator(lon, lat float64) (float64, float64) {
	lat = math.Max(-85, math.Min(85, lat))
	r := lat * math.Pi / 180
	return lon * math.Pi / 180, -math.Log(math.Tan(math.Pi/4 + r/2))
}
