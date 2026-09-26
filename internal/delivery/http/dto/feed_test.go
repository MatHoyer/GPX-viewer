package dto

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

func TestFeedCursorRoundTrip(t *testing.T) {
	cur := &domain.FeedCursor{At: time.Date(2026, 7, 1, 8, 30, 0, 123456000, time.UTC), ID: uuid.New()}
	feed := NewFeed(nil, cur)
	if feed.Next == nil {
		t.Fatal("no next cursor")
	}
	got, err := ParseFeedCursor(*feed.Next)
	if err != nil || !got.At.Equal(cur.At) || got.ID != cur.ID {
		t.Errorf("round trip = %+v, %v", got, err)
	}
	for _, bad := range []string{"", "x", "2026-07-01_notauuid", "yesterday_" + uuid.NewString()} {
		if _, err := ParseFeedCursor(bad); err == nil {
			t.Errorf("parsed %q", bad)
		}
	}
	if NewFeed(nil, nil).Next != nil {
		t.Error("cursor at the end")
	}
}
