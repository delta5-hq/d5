package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

/* Waitlist stores pending user registrations */
type Waitlist struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID    string             `json:"id" bson:"id"`
	Name      string             `json:"name" bson:"name"`
	Mail      string             `json:"mail" bson:"mail"`
	Password  string             `json:"password" bson:"password"`
	Meta      map[string]interface{} `json:"meta" bson:"meta"`
	Status    string             `json:"status,omitempty" bson:"status,omitempty"`
	CreatedAt time.Time          `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" bson:"updatedAt"`
}
