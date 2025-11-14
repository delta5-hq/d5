package freepik

type Service interface {
	SearchIcons(query string, limit int) (*IconSearchResponse, error)
	DownloadIcon(iconId string) (*DownloadResponse, error)
}

type IconSearchResponse struct {
	Total int    `json:"total"`
	Icons []Icon `json:"data"`
}

type Icon struct {
	ID          string   `json:"id"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	ThumbnailURL string   `json:"thumbnail"`
	DownloadURL  string   `json:"download_url"`
}

type DownloadResponse struct {
	URL         string `json:"url"`
	ContentType string `json:"content_type"`
	FileSize    int64  `json:"file_size"`
}
