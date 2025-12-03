package gateway

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func TestNewProxy(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}

	proxy := NewProxy(config)

	if proxy == nil {
		t.Fatal("NewProxy() returned nil")
	}

	if proxy.config != config {
		t.Error("NewProxy() config not set correctly")
	}

	if proxy.httpClient == nil {
		t.Error("NewProxy() httpClient not initialized")
	}

	if proxy.headerForwarder == nil {
		t.Error("NewProxy() headerForwarder not initialized")
	}

	if proxy.responseReader == nil {
		t.Error("NewProxy() responseReader not initialized")
	}
}

func TestProxy_Forward_Success(t *testing.T) {
	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/execute" {
			t.Errorf("Backend received path = %v, want /api/v1/execute", r.URL.Path)
		}

		if r.Method != "POST" {
			t.Errorf("Backend received method = %v, want POST", r.Method)
		}

		body, _ := io.ReadAll(r.Body)
		if string(body) != `{"test":"data"}` {
			t.Errorf("Backend received body = %v, want {\"test\":\"data\"}", string(body))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"success"}`))
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", strings.NewReader(`{"test":"data"}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Response status = %v, want %v", resp.StatusCode, http.StatusOK)
	}

	body, _ := io.ReadAll(resp.Body)
	if string(body) != `{"status":"success"}` {
		t.Errorf("Response body = %v, want {\"status\":\"success\"}", string(body))
	}
}

func TestProxy_Forward_GET_Request(t *testing.T) {
	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("Backend received method = %v, want GET", r.Method)
		}

		if r.URL.RawQuery != "q=test&limit=10" {
			t.Errorf("Backend received query = %v, want q=test&limit=10", r.URL.RawQuery)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`["result1","result2"]`))
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Get("/search", proxy.Forward("/integration/search"))

	req := httptest.NewRequest("GET", "/search?q=test&limit=10", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Response status = %v, want %v", resp.StatusCode, http.StatusOK)
	}
}

func TestProxy_Forward_HeaderForwarding(t *testing.T) {
	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-token" {
			t.Errorf("Authorization header = %v, want Bearer test-token", auth)
		}

		if userAgent := r.Header.Get("User-Agent"); userAgent != "TestClient/1.0" {
			t.Errorf("User-Agent header = %v, want TestClient/1.0", userAgent)
		}

		w.Header().Set("X-Custom-Response", "response-value")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", strings.NewReader("{}"))
	req.Header.Set("Authorization", "Bearer test-token")
	req.Header.Set("User-Agent", "TestClient/1.0")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if customHeader := resp.Header.Get("X-Custom-Response"); customHeader != "response-value" {
		t.Errorf("X-Custom-Response header = %v, want response-value", customHeader)
	}

	if cacheControl := resp.Header.Get("Cache-Control"); cacheControl != "no-cache" {
		t.Errorf("Cache-Control header = %v, want no-cache", cacheControl)
	}
}

func TestProxy_Forward_StatusCodePreservation(t *testing.T) {
	tests := []struct {
		name           string
		backendStatus  int
		backendBody    string
		expectedStatus int
	}{
		{
			name:           "200 OK",
			backendStatus:  http.StatusOK,
			backendBody:    `{"success":true}`,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "201 Created",
			backendStatus:  http.StatusCreated,
			backendBody:    `{"id":"123"}`,
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "400 Bad Request",
			backendStatus:  http.StatusBadRequest,
			backendBody:    `{"error":"invalid input"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "404 Not Found",
			backendStatus:  http.StatusNotFound,
			backendBody:    `{"error":"not found"}`,
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "500 Internal Server Error",
			backendStatus:  http.StatusInternalServerError,
			backendBody:    `{"error":"server error"}`,
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.backendStatus)
				w.Write([]byte(tt.backendBody))
			}))
			defer backendServer.Close()

			config := &Config{
				NodeJSBackendURL: backendServer.URL,
				NodeJSAPIRoot:    "/api/v1",
			}
			proxy := NewProxy(config)

			app := fiber.New(fiber.Config{
				BodyLimit: 10 * 1024 * 1024,
			})
			app.Post("/execute", proxy.Forward("/execute"))

			req := httptest.NewRequest("POST", "/execute", strings.NewReader("{}"))
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("Test request failed: %v", err)
			}

			if resp.StatusCode != tt.expectedStatus {
				t.Errorf("Response status = %v, want %v", resp.StatusCode, tt.expectedStatus)
			}

			body, _ := io.ReadAll(resp.Body)
			if string(body) != tt.backendBody {
				t.Errorf("Response body = %v, want %v", string(body), tt.backendBody)
			}
		})
	}
}

func TestProxy_Forward_BackendUnavailable(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:9999",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", strings.NewReader("{}"))
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != http.StatusInternalServerError {
		t.Errorf("Response status = %v, want %v", resp.StatusCode, http.StatusInternalServerError)
	}

	body, _ := io.ReadAll(resp.Body)
	if !strings.Contains(string(body), "Node.js backend unavailable") {
		t.Errorf("Response body should contain 'Node.js backend unavailable', got: %v", string(body))
	}
}

func TestProxy_Forward_LargePayload(t *testing.T) {
	largeData := strings.Repeat("x", 1024*100) // 100KB

	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if len(body) != len(largeData) {
			t.Errorf("Backend received body size = %v, want %v", len(body), len(largeData))
		}

		w.WriteHeader(http.StatusOK)
		w.Write(body)
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 200 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", strings.NewReader(largeData))
	resp, err := app.Test(req, int(10*time.Second/time.Millisecond))
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Response status = %v, want %v", resp.StatusCode, http.StatusOK)
	}

	body, _ := io.ReadAll(resp.Body)
	if len(body) != len(largeData) {
		t.Errorf("Response body size = %v, want %v", len(body), len(largeData))
	}
}

func TestProxy_Forward_BinaryData(t *testing.T) {
	binaryData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}

	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "image/png")
		w.WriteHeader(http.StatusOK)
		w.Write(body)
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", bytes.NewReader(binaryData))
	req.Header.Set("Content-Type", "image/png")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	body, _ := io.ReadAll(resp.Body)
	if !bytes.Equal(body, binaryData) {
		t.Error("Binary data not preserved through proxy")
	}
}

func TestProxy_Forward_ConcurrentRequests(t *testing.T) {
	requestCount := 0
	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		time.Sleep(10 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			req := httptest.NewRequest("POST", "/execute", strings.NewReader("{}"))
			resp, err := app.Test(req, -1)
			if err != nil {
				t.Errorf("Concurrent request failed: %v", err)
			}
			if resp.StatusCode != http.StatusOK {
				t.Errorf("Concurrent request status = %v, want %v", resp.StatusCode, http.StatusOK)
			}
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}

	if requestCount != 10 {
		t.Errorf("Backend received %v requests, want 10", requestCount)
	}
}

func TestProxy_Forward_EmptyBody(t *testing.T) {
	backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if len(body) != 0 {
			t.Errorf("Backend received non-empty body: %v", string(body))
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte(""))
	}))
	defer backendServer.Close()

	config := &Config{
		NodeJSBackendURL: backendServer.URL,
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
	})
	app.Post("/execute", proxy.Forward("/execute"))

	req := httptest.NewRequest("POST", "/execute", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Response status = %v, want %v", resp.StatusCode, http.StatusOK)
	}
}
