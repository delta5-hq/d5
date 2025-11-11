package thumbnail

// GenerateRequest represents the request to generate a thumbnail
type GenerateRequest struct {
	URL  string
	Size string
}

// GenerateResponse represents the thumbnail generation response
type GenerateResponse struct {
	URL       string `json:"url"`
	Thumbnail string `json:"thumbnail"` // Base64 encoded image or URL
	Size      string `json:"size"`
}

// Service defines the interface for thumbnail generation operations
type Service interface {
	// Generate creates a thumbnail from a URL
	Generate(req GenerateRequest) (*GenerateResponse, error)
}
