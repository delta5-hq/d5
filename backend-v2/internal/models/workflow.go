package models

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

type Workflow struct {
	UserID     string            `json:"userId" bson:"userId"`
	WorkflowID string            `json:"workflowId" bson:"workflowId"`
	Nodes      map[string]Node   `json:"nodes" bson:"nodes"`
	Edges      map[string]Edge   `json:"edges" bson:"edges"`
	Files      map[string]string `json:"files" bson:"files"`
}
