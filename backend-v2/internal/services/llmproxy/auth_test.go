package llmproxy

import (
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestBearerTokenExtractor_ValidToken(t *testing.T) {
	app := fiber.New()

	var extractedToken string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedToken = BearerTokenExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer test-token-123")

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedToken != "test-token-123" {
		t.Errorf("Extracted token = %v, want test-token-123", extractedToken)
	}
}

func TestBearerTokenExtractor_NoBearer(t *testing.T) {
	app := fiber.New()

	var extractedToken string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedToken = BearerTokenExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "test-token-123")

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedToken != "" {
		t.Errorf("Extracted token = %v, want empty string", extractedToken)
	}
}

func TestBearerTokenExtractor_EmptyHeader(t *testing.T) {
	app := fiber.New()

	var extractedToken string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedToken = BearerTokenExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedToken != "" {
		t.Errorf("Extracted token = %v, want empty string", extractedToken)
	}
}

func TestBearerTokenExtractor_OnlyBearer(t *testing.T) {
	app := fiber.New()

	var extractedToken string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedToken = BearerTokenExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer ")

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedToken != "" {
		t.Errorf("Extracted token = %v, want empty string", extractedToken)
	}
}

func TestHeaderAPIKeyExtractor_ValidKey(t *testing.T) {
	app := fiber.New()

	var extractedKey string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedKey = HeaderAPIKeyExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("x-api-key", "sk-test-key-456")

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedKey != "sk-test-key-456" {
		t.Errorf("Extracted key = %v, want sk-test-key-456", extractedKey)
	}
}

func TestHeaderAPIKeyExtractor_EmptyHeader(t *testing.T) {
	app := fiber.New()

	var extractedKey string
	app.Get("/test", func(c *fiber.Ctx) error {
		extractedKey = HeaderAPIKeyExtractor(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)

	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if extractedKey != "" {
		t.Errorf("Extracted key = %v, want empty string", extractedKey)
	}
}

func TestIsEmptyAPIKey_EmptyString(t *testing.T) {
	if !IsEmptyAPIKey("") {
		t.Error("Empty string should be considered empty API key")
	}
}

func TestIsEmptyAPIKey_EMPTY(t *testing.T) {
	if !IsEmptyAPIKey("EMPTY") {
		t.Error("'EMPTY' should be considered empty API key")
	}
}

func TestIsEmptyAPIKey_ValidKey(t *testing.T) {
	if IsEmptyAPIKey("sk-test-key") {
		t.Error("Valid key should not be considered empty")
	}
}

func TestIsEmptyAPIKey_Whitespace(t *testing.T) {
	if IsEmptyAPIKey("   ") {
		t.Error("Whitespace should not be considered empty (caller should trim)")
	}
}
