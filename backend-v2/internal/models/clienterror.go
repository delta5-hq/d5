package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

/* ClientError stores frontend error reports */
type ClientError struct {
	ID        primitive.ObjectID     `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID    string                 `json:"userId" bson:"userId"`
	Path      string                 `json:"path" bson:"path"`
	Backtrace string                 `json:"backtrace" bson:"backtrace"`
	Additions map[string]interface{} `json:"additions" bson:"additions"`
	CreatedAt time.Time              `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt" bson:"updatedAt"`
}
