package dto

import (
	"time"

	"github.com/MatHoyer/gpx-viewer/internal/domain"
)

type HikeInteractions struct {
	Kudos    int  `json:"kudos"`
	Comments int  `json:"comments"`
	Kudoed   bool `json:"kudoed"`
}

func NewHikeInteractions(i domain.HikeInteractions) *HikeInteractions {
	return &HikeInteractions{Kudos: i.Kudos, Comments: i.Comments, Kudoed: i.Kudoed}
}

type Comment struct {
	ID        string      `json:"id"`
	Body      string      `json:"body"`
	CreatedAt time.Time   `json:"createdAt"`
	Author    *PublicUser `json:"author,omitempty"`
}

func NewComment(c *domain.Comment) Comment {
	out := Comment{ID: c.ID.String(), Body: c.Body, CreatedAt: c.CreatedAt}
	if c.Author != nil {
		a := NewPublicUser(c.Author)
		out.Author = &a
	}
	return out
}

type NewCommentRequest struct {
	Body string `json:"body"`
}
