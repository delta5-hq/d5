package llmproxy

import (
	"encoding/json"
	"io"
	nethttp "net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend-v2/internal/common/http"

	"github.com/gofiber/fiber/v2"
)

func TestBuildProxyRequest_BasicRequest(t *testing.T) {
	body := map[string]interface{}{
		"model": "gpt-4",
		"messages": []map[string]string{
			{"role": "user", "content": "Hello"},
		},
	}

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:  "https://api.openai.com/v1/chat/completions",
		APIKey:     "sk-test-123",
		Body:       body,
		AuthHeader: headerAuth,
	})

	if err != nil {
		t.Fatalf("BuildProxyRequest failed: %v", err)
	}

	if req.Method != "POST" {
		t.Errorf("Method = %v, want POST", req.Method)
	}

	if req.URL.String() != "https://api.openai.com/v1/chat/completions" {
		t.Errorf("URL = %v, want https://api.openai.com/v1/chat/completions", req.URL.String())
	}

	if req.Header.Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type = %v, want application/json", req.Header.Get("Content-Type"))
	}

	if req.Header.Get("Authorization") != "Bearer sk-test-123" {
		t.Errorf("Authorization = %v, want Bearer sk-test-123", req.Header.Get("Authorization"))
	}
}

func TestBuildProxyRequest_WithAPIKeyHeader(t *testing.T) {
	body := map[string]interface{}{"model": "claude-3"}

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:  "https://api.anthropic.com/v1/messages",
		APIKey:     "sk-ant-123",
		Body:       body,
		AuthHeader: headerAPIKey,
	})

	if err != nil {
		t.Fatalf("BuildProxyRequest failed: %v", err)
	}

	if req.Header.Get("x-api-key") != "sk-ant-123" {
		t.Errorf("x-api-key = %v, want sk-ant-123", req.Header.Get("x-api-key"))
	}

	if req.Header.Get("Authorization") != "" {
		t.Error("Authorization header should not be set for x-api-key")
	}
}

func TestBuildProxyRequest_WithExtraHeaders(t *testing.T) {
	body := map[string]interface{}{"model": "claude-3"}
	extraHeaders := map[string]string{
		"anthropic-version": "2023-06-01",
		"anthropic-beta":    "test-feature",
	}

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:    "https://api.anthropic.com/v1/messages",
		APIKey:       "sk-ant-123",
		Body:         body,
		AuthHeader:   headerAPIKey,
		ExtraHeaders: extraHeaders,
	})

	if err != nil {
		t.Fatalf("BuildProxyRequest failed: %v", err)
	}

	if req.Header.Get("anthropic-version") != "2023-06-01" {
		t.Errorf("anthropic-version = %v, want 2023-06-01", req.Header.Get("anthropic-version"))
	}

	if req.Header.Get("anthropic-beta") != "test-feature" {
		t.Errorf("anthropic-beta = %v, want test-feature", req.Header.Get("anthropic-beta"))
	}
}

func TestBuildProxyRequest_BodyEncoding(t *testing.T) {
	body := map[string]interface{}{
		"model":       "gpt-4",
		"temperature": 0.7,
		"max_tokens":  100,
	}

	req, err := BuildProxyRequest(ProxyRequest{
		TargetURL:  "https://api.openai.com/v1/chat/completions",
		APIKey:     "sk-test-123",
		Body:       body,
		AuthHeader: headerAuth,
	})

	if err != nil {
		t.Fatalf("BuildProxyRequest failed: %v", err)
	}

	bodyBytes, _ := io.ReadAll(req.Body)
	var decodedBody map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &decodedBody); err != nil {
		t.Fatalf("Failed to unmarshal body: %v", err)
	}

	if decodedBody["model"] != "gpt-4" {
		t.Errorf("model = %v, want gpt-4", decodedBody["model"])
	}

	if decodedBody["temperature"] != 0.7 {
		t.Errorf("temperature = %v, want 0.7", decodedBody["temperature"])
	}
}

func TestExecuteProxyRequest_Success(t *testing.T) {
	mockServer := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusOK)
		if _, err := w.Write([]byte(`{"success":true}`)); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer mockServer.Close()

	factory := http.NewClientFactory()
	client := factory.Create(10 * time.Second)

	req, _ := nethttp.NewRequest("POST", mockServer.URL, strings.NewReader("{}"))

	body, status, err := ExecuteProxyRequest(client, req)

	if err != nil {
		t.Fatalf("ExecuteProxyRequest failed: %v", err)
	}

	if status != nethttp.StatusOK {
		t.Errorf("Status = %v, want %v", status, nethttp.StatusOK)
	}

	if string(body) != `{"success":true}` {
		t.Errorf("Body = %v, want {\"success\":true}", string(body))
	}
}

func TestExecuteProxyRequest_ErrorResponse(t *testing.T) {
	mockServer := httptest.NewServer(nethttp.HandlerFunc(func(w nethttp.ResponseWriter, r *nethttp.Request) {
		w.WriteHeader(nethttp.StatusBadRequest)
		if _, err := w.Write([]byte(`{"error":"invalid request"}`)); err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer mockServer.Close()

	factory := http.NewClientFactory()
	client := factory.Create(10 * time.Second)

	req, _ := nethttp.NewRequest("POST", mockServer.URL, strings.NewReader("{}"))

	body, status, err := ExecuteProxyRequest(client, req)

	if err != nil {
		t.Fatalf("ExecuteProxyRequest failed: %v", err)
	}

	if status != nethttp.StatusBadRequest {
		t.Errorf("Status = %v, want %v", status, nethttp.StatusBadRequest)
	}

	if !strings.Contains(string(body), "invalid request") {
		t.Errorf("Body should contain error message, got: %v", string(body))
	}
}

func TestSendProxyResponse_Success(t *testing.T) {
	app := fiber.New()

	app.Post("/test", func(c *fiber.Ctx) error {
		return SendProxyResponse(c, []byte(`{"result":"ok"}`), nethttp.StatusOK)
	})

	req := httptest.NewRequest("POST", "/test", nil)
	resp, err := app.Test(req, -1)

	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != nethttp.StatusOK {
		t.Errorf("Status = %v, want %v", resp.StatusCode, nethttp.StatusOK)
	}

	if resp.Header.Get("Content-Type") != "application/json" {
		t.Errorf("Content-Type = %v, want application/json", resp.Header.Get("Content-Type"))
	}

	body, _ := io.ReadAll(resp.Body)
	if string(body) != `{"result":"ok"}` {
		t.Errorf("Body = %v, want {\"result\":\"ok\"}", string(body))
	}
}

func TestSendProxyResponse_CustomStatusCode(t *testing.T) {
	app := fiber.New()

	app.Post("/test", func(c *fiber.Ctx) error {
		return SendProxyResponse(c, []byte(`{"error":"not found"}`), nethttp.StatusNotFound)
	})

	req := httptest.NewRequest("POST", "/test", nil)
	resp, err := app.Test(req, -1)

	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != nethttp.StatusNotFound {
		t.Errorf("Status = %v, want %v", resp.StatusCode, nethttp.StatusNotFound)
	}
}
