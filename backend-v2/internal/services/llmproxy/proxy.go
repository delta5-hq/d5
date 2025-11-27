package llmproxy

import (
	"backend-v2/internal/common/http"
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/gofiber/fiber/v2"
	nethttp "net/http"
)

type ProxyRequest struct {
	TargetURL    string
	APIKey       string
	Body         map[string]interface{}
	AuthHeader   string
	ExtraHeaders map[string]string
}

func BuildProxyRequest(req ProxyRequest) (*nethttp.Request, error) {
	bodyBytes, err := json.Marshal(req.Body)
	if err != nil {
		return nil, fmt.Errorf("marshal body: %w", err)
	}

	httpReq, err := nethttp.NewRequest("POST", req.TargetURL, bytes.NewReader(bodyBytes))
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

func ExecuteProxyRequest(client http.Client, req *nethttp.Request) ([]byte, int, error) {
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("execute request: %w", err)
	}

	reader := http.NewResponseReader()
	body, status, err := reader.ReadWithStatus(resp)
	if err != nil {
		return nil, status, fmt.Errorf("read response: %w", err)
	}

	return body, status, nil
}

func SendProxyResponse(c *fiber.Ctx, body []byte, statusCode int) error {
	c.Status(statusCode)
	c.Set(headerContentType, contentTypeJSON)
	return c.Send(body)
}
