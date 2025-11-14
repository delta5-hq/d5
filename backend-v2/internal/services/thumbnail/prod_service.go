package thumbnail

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"time"
)

// prodService is the production implementation for thumbnail generation
type prodService struct {
	client *http.Client
}

// NewProdService creates a new production thumbnail service
func NewProdService() Service {
	return &prodService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Generate creates a thumbnail from a URL using screenshot API or image processing
func (s *prodService) Generate(req GenerateRequest) (*GenerateResponse, error) {
	if req.URL == "" {
		return nil, errors.New("url is required")
	}

	/* In production, this would call a screenshot service API */
	/* For now, implement basic image fetching and resizing */

	httpReq, err := http.NewRequest("GET", req.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("User-Agent", "Mozilla/5.0 (compatible; D5Thumbnail/1.0)")

	resp, err := s.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	/* Read response body */
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	/* Try to decode as image */
	img, format, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		/* If not an image, return error */
		return nil, fmt.Errorf("URL does not point to a valid image: %w", err)
	}

	/* For simplicity, encode the original image to base64 */
	/* In production, would resize based on req.Size */
	var buf bytes.Buffer
	switch format {
	case "jpeg", "jpg":
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
			return nil, fmt.Errorf("failed to encode jpeg: %w", err)
		}
	case "png":
		if err := png.Encode(&buf, img); err != nil {
			return nil, fmt.Errorf("failed to encode png: %w", err)
		}
	default:
		/* Default to PNG encoding */
		if err := png.Encode(&buf, img); err != nil {
			return nil, fmt.Errorf("failed to encode image: %w", err)
		}
	}

	thumbnailBase64 := base64.StdEncoding.EncodeToString(buf.Bytes())

	return &GenerateResponse{
		URL:       req.URL,
		Thumbnail: thumbnailBase64,
		Size:      req.Size,
	}, nil
}
