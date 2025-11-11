package scraper

// noopService is a no-op implementation for E2E testing
type noopService struct{}

// NewNoopService creates a new noop scraper service
func NewNoopService() Service {
	return &noopService{}
}

// ScrapeV2 returns mock scraped content for E2E tests
func (s *noopService) ScrapeV2(url string) (*ScrapeV2Response, error) {
	return &ScrapeV2Response{
		Content: "Mock scraped content from " + url,
		Title:   "Mock Page Title",
		URL:     url,
	}, nil
}

// ScrapeFiles returns mock file list for E2E tests
func (s *noopService) ScrapeFiles(url string) ([]ScrapeFilesResponse, error) {
	return []ScrapeFilesResponse{
		{
			URL:      url + "/file1.pdf",
			FileName: "document.pdf",
			FileType: "application/pdf",
			FileSize: 1024000,
		},
		{
			URL:      url + "/file2.docx",
			FileName: "report.docx",
			FileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			FileSize: 512000,
		},
	}, nil
}
