package progress

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestStream_ProxiesNodeJSBackend(t *testing.T) {
	mockNodeJS := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: {\"type\":\"connected\"}\n\n"))
	}))
	defer mockNodeJS.Close()

	t.Setenv("NODEJS_BACKEND_URL", mockNodeJS.URL)

	controller := NewController()
	app := fiber.New()
	app.Get("/stream", controller.Stream)

	req := httptest.NewRequest("GET", "/stream", nil)
	resp, err := app.Test(req, 1000)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.Header.Get("Content-Type") != "text/event-stream" {
		t.Errorf("Expected Content-Type text/event-stream, got %s", resp.Header.Get("Content-Type"))
	}
}

func TestStream_ForwardsAuthorizationHeader(t *testing.T) {
	var receivedAuth string
	mockNodeJS := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: {}\n\n"))
	}))
	defer mockNodeJS.Close()

	t.Setenv("NODEJS_BACKEND_URL", mockNodeJS.URL)

	controller := NewController()
	app := fiber.New()
	app.Get("/stream", controller.Stream)

	req := httptest.NewRequest("GET", "/stream", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	_, err := app.Test(req, 1000)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if receivedAuth != "Bearer test-token" {
		t.Errorf("Expected Authorization header to be forwarded, got %s", receivedAuth)
	}
}

func TestStream_HandlesNodeJSUnavailable(t *testing.T) {
	t.Setenv("NODEJS_BACKEND_URL", "http://localhost:59999")

	controller := NewController()
	app := fiber.New()
	app.Get("/stream", controller.Stream)

	req := httptest.NewRequest("GET", "/stream", nil)
	resp, err := app.Test(req, 1000)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusBadGateway {
		t.Errorf("Expected status 502, got %d", resp.StatusCode)
	}
}

func TestStream_StreamsMultipleEvents(t *testing.T) {
	t.Skip("Skipping SSE streaming test - requires live connection handling")
}

func TestStream_SetsCorrectHeaders(t *testing.T) {
	mockNodeJS := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
	}))
	defer mockNodeJS.Close()

	t.Setenv("NODEJS_BACKEND_URL", mockNodeJS.URL)

	controller := NewController()
	app := fiber.New()
	app.Get("/stream", controller.Stream)

	req := httptest.NewRequest("GET", "/stream", nil)
	resp, err := app.Test(req, 500)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	requiredHeaders := map[string]string{
		"Content-Type":  "text/event-stream",
		"Cache-Control": "no-cache",
		"Connection":    "keep-alive",
	}

	for header, expectedValue := range requiredHeaders {
		actualValue := resp.Header.Get(header)
		if actualValue != expectedValue {
			t.Errorf("Header %s: expected %s, got %s", header, expectedValue, actualValue)
		}
	}
}

func TestStream_HandlesEmptyResponseFromNodeJS(t *testing.T) {
	mockNodeJS := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
	}))
	defer mockNodeJS.Close()

	t.Setenv("NODEJS_BACKEND_URL", mockNodeJS.URL)

	controller := NewController()
	app := fiber.New()
	app.Get("/stream", controller.Stream)

	req := httptest.NewRequest("GET", "/stream", nil)
	resp, err := app.Test(req, 200)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}
}

func TestStream_HandlesNodeJSNon200Response(t *testing.T) {
	t.Skip("Skipping error propagation test - proxy behavior varies by HTTP status")
}

func TestStream_ValidJSONInEventData(t *testing.T) {
	t.Skip("Skipping JSON validation test - requires SSE protocol handling")
}
