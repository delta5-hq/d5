package models

import (
	"time"
)

type Macro struct {
	ID            string          `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID        string          `json:"userId" bson:"userId"`
	Name          string          `json:"name" bson:"name"`
	Keywords      []string        `json:"keywords,omitempty" bson:"keywords,omitempty"`
	QueryType     string          `json:"queryType" bson:"queryType"`
	Cell          Node            `json:"cell" bson:"cell"`
	WorkflowNodes map[string]Node `json:"workflowNodes" bson:"workflowNodes"`
	UpdatedAt     time.Time       `json:"updatedAt" bson:"updatedAt"`
	CreatedAt     time.Time       `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
}
