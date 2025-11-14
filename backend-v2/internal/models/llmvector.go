package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

/* Vector item with content and optional embedding */
type MemoryVector struct {
	Content   string                 `json:"content" bson:"content"`
	Embedding []float64              `json:"embedding,omitempty" bson:"embedding,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty" bson:"metadata,omitempty"`
}

/* LLMVector stores AI context data in nested structure: store[type][source][]vectors */
type LLMVector struct {
	ID        primitive.ObjectID                   `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID    string                               `json:"userId" bson:"userId"`
	Name      *string                              `json:"name" bson:"name"` // Nullable
	Store     map[string]map[string][]MemoryVector `json:"store" bson:"store"`
	CreatedAt time.Time                            `json:"createdAt" bson:"createdAt"`
	UpdatedAt time.Time                            `json:"updatedAt" bson:"updatedAt"`
}
