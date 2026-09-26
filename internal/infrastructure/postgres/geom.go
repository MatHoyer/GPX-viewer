package postgres

import (
	"database/sql/driver"
	"encoding/binary"
	"encoding/hex"
	"fmt"

	"github.com/twpayne/go-geom"
	"github.com/twpayne/go-geom/encoding/ewkbhex"
	"github.com/twpayne/go-geom/encoding/wkb"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

const srid = 4326

// MultiLineStringZ maps a PostGIS geometry(MultiLineStringZ,4326) column.
type MultiLineStringZ struct {
	*geom.MultiLineString
}

func (MultiLineStringZ) GormDataType() string {
	return "geometry(MultiLineStringZ,4326)"
}

func (g MultiLineStringZ) Value() (driver.Value, error) {
	if g.MultiLineString == nil {
		return nil, nil
	}
	return ewkbhex.Encode(g.SetSRID(srid), binary.LittleEndian)
}

func (g *MultiLineStringZ) Scan(src any) error {
	var s string
	switch v := src.(type) {
	case nil:
		g.MultiLineString = nil
		return nil
	case string:
		s = v
	case []byte:
		s = string(v)
	default:
		return fmt.Errorf("unsupported geometry source %T", src)
	}
	t, err := ewkbhex.Decode(s)
	if err != nil {
		return err
	}
	mls, ok := t.(*geom.MultiLineString)
	if !ok {
		return fmt.Errorf("expected MultiLineString, got %T", t)
	}
	g.MultiLineString = mls
	return nil
}

func segmentsToGeom(segs []domain.Segment) (MultiLineStringZ, error) {
	mls := geom.NewMultiLineString(geom.XYZ)
	for _, seg := range segs {
		flat := make([]float64, 0, len(seg)*3)
		for _, p := range seg {
			flat = append(flat, p.Lon, p.Lat, p.Ele)
		}
		if err := mls.Push(geom.NewLineStringFlat(geom.XYZ, flat)); err != nil {
			return MultiLineStringZ{}, err
		}
	}
	return MultiLineStringZ{mls}, nil
}

// wkbToSegments decodes WKB (as returned by ST_AsBinary) into segments.
func wkbToSegments(data []byte) ([]domain.Segment, error) {
	// Some drivers hand back bytea as hex text.
	if len(data) > 2 && data[0] == '\\' && data[1] == 'x' {
		decoded, err := hex.DecodeString(string(data[2:]))
		if err != nil {
			return nil, err
		}
		data = decoded
	}
	t, err := wkb.Unmarshal(data)
	if err != nil {
		return nil, err
	}
	var lines []*geom.LineString
	switch g := t.(type) {
	case *geom.MultiLineString:
		for i := 0; i < g.NumLineStrings(); i++ {
			lines = append(lines, g.LineString(i))
		}
	case *geom.LineString:
		lines = append(lines, g)
	default:
		return nil, fmt.Errorf("unexpected geometry %T", t)
	}

	segs := make([]domain.Segment, 0, len(lines))
	for _, ls := range lines {
		seg := make(domain.Segment, 0, ls.NumCoords())
		for i := 0; i < ls.NumCoords(); i++ {
			c := ls.Coord(i)
			p := domain.Point{Lon: c.X(), Lat: c.Y()}
			if z := ls.Layout().ZIndex(); z != -1 {
				p.Ele = c[z]
			}
			seg = append(seg, p)
		}
		segs = append(segs, seg)
	}
	return segs, nil
}
