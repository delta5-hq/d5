package scraper

// ScrapeV2Response represents the response from ScrapeV2
type ScrapeV2Response struct {
	Content string `json:"content"`
	Title   string `json:"title"`
	URL     string `json:"url"`
}

// ScrapeFilesResponse represents a file found during scraping
type ScrapeFilesResponse struct {
	URL      string `json:"url"`
	FileName string `json:"fileName"`
	FileType string `json:"fileType"`
	FileSize int64  `json:"fileSize"`
}

// Service defines the interface for web scraping operations
type Service interface {
	// ScrapeV2 scrapes a URL and returns the content
	ScrapeV2(url string) (*ScrapeV2Response, error)

	// ScrapeFiles scrapes a URL and returns a list of files found
	ScrapeFiles(url string) ([]ScrapeFilesResponse, error)
}
