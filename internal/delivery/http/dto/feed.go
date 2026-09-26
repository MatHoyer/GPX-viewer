package dto

import (
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type Feed struct {
	Hikes []Hike `json:"hikes"`
	// Next is passed as ?after= to get the following page; null at the end.
	Next *string `json:"next"`
}

func NewFeed(hikes []domain.Hike, next *domain.FeedCursor) Feed {
	out := Feed{Hikes: make([]Hike, len(hikes))}
	for i := range hikes {
		out.Hikes[i] = NewHike(&hikes[i])
	}
	if next != nil {
		c := next.At.UTC().Format(time.RFC3339Nano) + "_" + next.ID.String()
		out.Next = &c
	}
	return out
}

// ParseFeedCursor reads a cursor made by NewFeed.
func ParseFeedCursor(s string) (*domain.FeedCursor, error) {
	at, id, ok := strings.Cut(s, "_")
	if !ok {
		return nil, fmt.Errorf("malformed cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, at)
	if err != nil {
		return nil, err
	}
	u, err := uuid.Parse(id)
	if err != nil {
		return nil, err
	}
	return &domain.FeedCursor{At: t, ID: u}, nil
}
