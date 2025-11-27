package llmproxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type HTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type ProxyRequest struct {
	TargetURL    string
	APIKey       string
	Body         map[string]interface{}
	AuthHeader   string
	ExtraHeaders map[string]string
}

func BuildProxyRequest(req ProxyRequest) (*http.Request, error) {
	bodyBytes, err := json.Marshal(req.Body)
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}

	httpReq, err := http.NewRequest("POST", req.TargetURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set(headerContentType, contentTypeJSON)
	
	if req.AuthHeader == headerAuth {
		httpReq.Header.Set(headerAuth, fmt.Sprintf("%s%s", bearerPrefix, req.APIKey))
	} else {
		httpReq.Header.Set(req.AuthHeader, req.APIKey)
	}

	for key, value := range req.ExtraHeaders {
		httpReq.Header.Set(key, value)
	}

	return httpReq, nil
}

func ExecuteProxyRequest(client HTTPClient, req *http.Request) ([]byte, int, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, fmt.Errorf("read response: %w", err)
	}

	return body, resp.StatusCode, nil
}

func SendProxyResponse(c *fiber.Ctx, body []byte, statusCode int) error {
	c.Status(statusCode)
	c.Set(headerContentType, contentTypeJSON)
	return c.Send(body)
}
