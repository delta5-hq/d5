package freepik

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) SearchIcons(query string, limit int) (*IconSearchResponse, error) {
	return &IconSearchResponse{
		Total: 2,
		Icons: []Icon{
			{
				ID:          "mock-icon-1",
				Description: "Mock icon for " + query,
				Tags:        []string{query, "mock", "icon"},
				ThumbnailURL: "https://example.com/mock-icon-1-thumb.svg",
				DownloadURL:  "https://example.com/mock-icon-1.svg",
			},
			{
				ID:          "mock-icon-2",
				Description: "Another mock icon for " + query,
				Tags:        []string{query, "mock", "vector"},
				ThumbnailURL: "https://example.com/mock-icon-2-thumb.svg",
				DownloadURL:  "https://example.com/mock-icon-2.svg",
			},
		},
	}, nil
}

func (s *noopService) DownloadIcon(iconId string) (*DownloadResponse, error) {
	return &DownloadResponse{
		URL:         "https://example.com/mock-icon-download.svg",
		ContentType: "image/svg+xml",
		FileSize:    2048,
	}, nil
}
