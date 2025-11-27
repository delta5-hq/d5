package models

import (
	"backend-v2/internal/common/constants"
)

type MediaPosition string

const (
	MediaCrop      MediaPosition = "crop"
	MediaBody      MediaPosition = "body"
	MediaStretch   MediaPosition = "stretch"
	MediaFullWidth MediaPosition = "fullWidth"
)

type Node struct {
	ID            string        `json:"id" bson:"id"`
	Children      []string      `json:"children" bson:"children"`
	Image         string        `json:"image" bson:"image"`
	ImagePosition MediaPosition `json:"imagePosition" bson:"imagePosition"`
	Video         string        `json:"video" bson:"video"`
	File          string        `json:"file" bson:"file"`
	Title         string        `json:"title" bson:"title"`
	Collapsed     bool          `json:"collapsed" bson:"collapsed"`
	Color         string        `json:"color" bson:"color"`
	BorderColor   string        `json:"borderColor" bson:"borderColor"`
	Scale         int           `json:"scale" bson:"scale"`
	Parent        string        `json:"parent" bson:"parent"`
	X             int64         `json:"x" bson:"x"`
	Y             int64         `json:"y" bson:"y"`
	Width         int           `json:"width" bson:"width"`
	Height        int           `json:"height" bson:"height"`
	Command       string        `json:"command" bson:"command"`
	Prompts       []string      `json:"prompts" bson:"prompts"`
}

type Edge struct {
	ID    string `json:"id" bson:"id"`
	Start string `json:"start" bson:"start"`
	End   string `json:"end" bson:"end"`
	Title string `json:"title" bson:"title"`
	Color string `json:"color" bson:"color"`
}

type RoleBinding struct {
	SubjectID   string                `json:"subjectId" bson:"subjectId"`
	SubjectType constants.SubjectType `json:"subjectType" bson:"subjectType"`
	Role        constants.AccessRole  `json:"role" bson:"role"`
}

type WorkflowState struct {
	Enabled   bool `json:"enabled" bson:"enabled"`
	Hidden    bool `json:"hidden" bson:"hidden"`
	Writeable bool `json:"writeable" bson:"writeable"`
}

type Share struct {
	Public WorkflowState `json:"public" bson:"public"`
	Access []RoleBinding `json:"access" bson:"access"`
}

type Workflow struct {
	UserID     string            `json:"userId" bson:"userId"`
	WorkflowID string            `json:"workflowId" bson:"workflowId"`
	Title      string            `json:"title" bson:"title"`
	UpdatedAt  int64             `json:"updatedAt" bson:"updatedAt"`
	Nodes      map[string]Node   `json:"nodes" bson:"nodes"`
	Edges      map[string]Edge   `json:"edges" bson:"edges"`
	Files      map[string]string `json:"files" bson:"files"`
	Share      Share             `json:"share" bson:"share"`
	Category   *string           `json:"category" bson:"category"`
}

func (w Workflow) IsPublic () bool {
	return  w.Share.Public.Enabled
}

func (w Workflow) IsPublicWriteable () bool {
	return  w.Share.Public.Enabled && w.Share.Public.Writeable
}