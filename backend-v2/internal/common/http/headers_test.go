package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

func TestHeaderForwarder_ForwardRequest(t *testing.T) {
	forwarder := NewHeaderForwarder()

	app := fiber.New()
	app.Post("/test", func(c *fiber.Ctx) error {
		httpReq, err := http.NewRequest("POST", "http://target.com/api", nil)
		if err != nil {
			return err
		}

		forwarder.ForwardRequest(c, httpReq)

		userAgent := httpReq.Header.Get("User-Agent")
		if userAgent != "TestClient/1.0" {
			t.Errorf("ForwardRequest() User-Agent = %v, want TestClient/1.0", userAgent)
		}

		contentType := httpReq.Header.Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("ForwardRequest() Content-Type = %v, want application/json", contentType)
		}

		customHeader := httpReq.Header.Get("X-Custom-Header")
		if customHeader != "custom-value" {
			t.Errorf("ForwardRequest() X-Custom-Header = %v, want custom-value", customHeader)
		}

		return c.SendStatus(200)
	})

	req := httptest.NewRequest("POST", "/test", strings.NewReader("test"))
	req.Header.Set("User-Agent", "TestClient/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Custom-Header", "custom-value")

	_, err := app.Test(req)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestHeaderForwarder_ForwardResponse(t *testing.T) {
	forwarder := NewHeaderForwarder()

	app := fiber.New()
	app.Get("/test", func(c *fiber.Ctx) error {
		httpResp := &http.Response{
			Header: http.Header{
				"Content-Type":     []string{"application/json"},
				"X-Custom-Header":  []string{"response-value"},
				"X-Multiple":       []string{"value1", "value2"},
				"Cache-Control":    []string{"no-cache"},
			},
		}

		forwarder.ForwardResponse(c, httpResp)

		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if contentType := resp.Header.Get("Content-Type"); contentType != "application/json" {
		t.Errorf("ForwardResponse() Content-Type = %v, want application/json", contentType)
	}

	if customHeader := resp.Header.Get("X-Custom-Header"); customHeader != "response-value" {
		t.Errorf("ForwardResponse() X-Custom-Header = %v, want response-value", customHeader)
	}

	if cacheControl := resp.Header.Get("Cache-Control"); cacheControl != "no-cache" {
		t.Errorf("ForwardResponse() Cache-Control = %v, want no-cache", cacheControl)
	}
}

func TestHeaderForwarder_EmptyHeaders(t *testing.T) {
	forwarder := NewHeaderForwarder()

	app := fiber.New()
	app.Post("/test", func(c *fiber.Ctx) error {
		httpReq, err := http.NewRequest("POST", "http://target.com/api", nil)
		if err != nil {
			return err
		}

		forwarder.ForwardRequest(c, httpReq)

		if len(httpReq.Header) == 0 {
			t.Error("ForwardRequest() should forward at least some headers (Host, etc)")
		}

		return c.SendStatus(200)
	})

	req := httptest.NewRequest("POST", "/test", nil)
	_, err := app.Test(req)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestHeaderForwarder_ForwardResponse_MultipleValues(t *testing.T) {
	forwarder := NewHeaderForwarder()

	app := fiber.New()
	app.Get("/test", func(c *fiber.Ctx) error {
		httpResp := &http.Response{
			Header: http.Header{
				"Set-Cookie": []string{"session=abc123", "user=john"},
			},
		}

		forwarder.ForwardResponse(c, httpResp)

		return c.SendStatus(200)
	})

	req := httptest.NewRequest("GET", "/test", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	cookies := resp.Header.Values("Set-Cookie")
	if len(cookies) < 1 {
		t.Error("ForwardResponse() should forward multiple header values")
	}
}

func TestHeaderForwarder_PreservesSpecialCharacters(t *testing.T) {
	forwarder := NewHeaderForwarder()

	app := fiber.New()
	app.Post("/test", func(c *fiber.Ctx) error {
		httpReq, err := http.NewRequest("POST", "http://target.com/api", nil)
		if err != nil {
			return err
		}

		forwarder.ForwardRequest(c, httpReq)

		authHeader := httpReq.Header.Get("Authorization")
		expected := "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
		if authHeader != expected {
			t.Errorf("ForwardRequest() Authorization = %v, want %v", authHeader, expected)
		}

		return c.SendStatus(200)
	})

	req := httptest.NewRequest("POST", "/test", nil)
	req.Header.Set("Authorization", "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9")

	_, err := app.Test(req)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestNewHeaderForwarder(t *testing.T) {
	forwarder := NewHeaderForwarder()

	if forwarder == nil {
		t.Fatal("NewHeaderForwarder() returned nil")
	}
}

func TestHeaderForwarder_ConcurrentSafety(t *testing.T) {
	forwarder := NewHeaderForwarder()

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func() {
			ctx := &fasthttp.RequestCtx{}
			httpReq, _ := http.NewRequest("GET", "http://test.com", nil)
			
			fiberCtx := fiber.New().AcquireCtx(ctx)
			defer fiber.New().ReleaseCtx(fiberCtx)

			forwarder.ForwardRequest(fiberCtx, httpReq)
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
