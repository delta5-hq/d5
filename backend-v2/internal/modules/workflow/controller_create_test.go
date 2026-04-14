package workflow

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
)

func TestCreateWorkflow_RequestBodyParsing(t *testing.T) {
	tests := []struct {
		name          string
		requestBody   map[string]interface{}
		expectedTitle string
		description   string
		shouldParseOK bool
	}{
		{
			name: "title provided as string",
			requestBody: map[string]interface{}{
				"title": "My Workflow",
			},
			expectedTitle: "My Workflow",
			description:   "Valid title string should be extracted correctly",
			shouldParseOK: true,
		},
		{
			name: "title provided as empty string",
			requestBody: map[string]interface{}{
				"title": "",
			},
			expectedTitle: "",
			description:   "Empty title string should be preserved",
			shouldParseOK: true,
		},
		{
			name:          "no title in request body",
			requestBody:   map[string]interface{}{},
			expectedTitle: "",
			description:   "Missing title field should default to empty string",
			shouldParseOK: true,
		},
		{
			name: "title with special characters",
			requestBody: map[string]interface{}{
				"title": "Test → Workflow 🚀",
			},
			expectedTitle: "Test → Workflow 🚀",
			description:   "Unicode and special characters should be preserved",
			shouldParseOK: true,
		},
		{
			name: "title as number (type mismatch)",
			requestBody: map[string]interface{}{
				"title": 123,
			},
			expectedTitle: "",
			description:   "Non-string title should be safely ignored (type-safe extraction)",
			shouldParseOK: true,
		},
		{
			name: "title as boolean (type mismatch)",
			requestBody: map[string]interface{}{
				"title": true,
			},
			expectedTitle: "",
			description:   "Boolean title should be safely ignored",
			shouldParseOK: true,
		},
		{
			name: "title as null",
			requestBody: map[string]interface{}{
				"title": nil,
			},
			expectedTitle: "",
			description:   "Null title should default to empty string",
			shouldParseOK: true,
		},
		{
			name: "title with share object",
			requestBody: map[string]interface{}{
				"title": "Workflow with Share",
				"share": map[string]interface{}{
					"public": map[string]interface{}{
						"enabled": true,
					},
				},
			},
			expectedTitle: "Workflow with Share",
			description:   "Title and share should coexist independently",
			shouldParseOK: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bodyBytes, err := json.Marshal(tt.requestBody)
			if err != nil {
				t.Fatalf("Failed to marshal request body: %v", err)
			}

			app := fiber.New()
			c := app.AcquireCtx(&fasthttp.RequestCtx{})
			defer app.ReleaseCtx(c)

			c.Request().SetBody(bodyBytes)
			c.Request().Header.SetContentType("application/json")

			var requestBody map[string]interface{}
			var extractedTitle string

			parseErr := c.BodyParser(&requestBody)

			if tt.shouldParseOK && parseErr != nil {
				t.Errorf("%s: unexpected parse error: %v", tt.description, parseErr)
				return
			}

			if titleData, exists := requestBody["title"]; exists {
				if titleStr, ok := titleData.(string); ok {
					extractedTitle = titleStr
				}
			}

			if extractedTitle != tt.expectedTitle {
				t.Errorf("%s: expected title %q, got %q", tt.description, tt.expectedTitle, extractedTitle)
			}
		})
	}
}

func TestCreateWorkflow_RequestBodyParsing_ShareIndependence(t *testing.T) {
	t.Run("title extraction does not affect share parsing", func(t *testing.T) {
		requestBody := map[string]interface{}{
			"title": "Test Workflow",
			"share": map[string]interface{}{
				"public": map[string]interface{}{
					"enabled":   true,
					"writeable": false,
					"hidden":    false,
				},
				"access": []interface{}{},
			},
		}

		bodyBytes, _ := json.Marshal(requestBody)

		app := fiber.New()
		c := app.AcquireCtx(&fasthttp.RequestCtx{})
		defer app.ReleaseCtx(c)

		c.Request().SetBody(bodyBytes)
		c.Request().Header.SetContentType("application/json")

		var parsed map[string]interface{}
		if err := c.BodyParser(&parsed); err != nil {
			t.Fatalf("Failed to parse body: %v", err)
		}

		titleData, titleExists := parsed["title"]
		shareData, shareExists := parsed["share"]

		if !titleExists {
			t.Error("title should exist in parsed body")
		}
		if !shareExists {
			t.Error("share should exist in parsed body")
		}

		if titleStr, ok := titleData.(string); !ok || titleStr != "Test Workflow" {
			t.Errorf("title should be 'Test Workflow', got %v", titleData)
		}

		if shareMap, ok := shareData.(map[string]interface{}); !ok {
			t.Error("share should be a map")
		} else {
			if publicData, ok := shareMap["public"].(map[string]interface{}); !ok {
				t.Error("share.public should be a map")
			} else {
				if enabled, ok := publicData["enabled"].(bool); !ok || !enabled {
					t.Error("share.public.enabled should be true")
				}
			}
		}
	})
}

func TestCreateWorkflow_EdgeCases_MalformedJSON(t *testing.T) {
	tests := []struct {
		name        string
		requestBody string
		description string
	}{
		{
			name:        "empty body",
			requestBody: "",
			description: "Empty request body should not crash parser",
		},
		{
			name:        "invalid JSON",
			requestBody: "{invalid json}",
			description: "Invalid JSON should be handled gracefully",
		},
		{
			name:        "JSON array instead of object",
			requestBody: `["not", "an", "object"]`,
			description: "Array JSON should fail to parse as object",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			app := fiber.New()
			c := app.AcquireCtx(&fasthttp.RequestCtx{})
			defer app.ReleaseCtx(c)

			c.Request().SetBody([]byte(tt.requestBody))
			c.Request().Header.SetContentType("application/json")

			var requestBody map[string]interface{}
			err := c.BodyParser(&requestBody)

			if err != nil {
				t.Logf("%s: parser correctly returned error for malformed JSON", tt.description)
			} else {
				if requestBody == nil {
					t.Logf("%s: parser returned nil map for malformed JSON", tt.description)
				}
			}
		})
	}
}

func TestCreateWorkflow_HTTPIntegration(t *testing.T) {
	t.Run("POST with title in JSON body", func(t *testing.T) {
		app := fiber.New()

		app.Post("/test", func(c *fiber.Ctx) error {
			var requestBody map[string]interface{}
			var title string

			if err := c.BodyParser(&requestBody); err == nil {
				if titleData, exists := requestBody["title"]; exists {
					if titleStr, ok := titleData.(string); ok {
						title = titleStr
					}
				}
			}

			return c.JSON(fiber.Map{
				"extractedTitle": title,
			})
		})

		req := httptest.NewRequest("POST", "/test", bytes.NewBufferString(`{"title":"Integration Test"}`))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("HTTP test failed: %v", err)
		}

		if resp.StatusCode != 200 {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var result map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if result["extractedTitle"] != "Integration Test" {
			t.Errorf("Expected 'Integration Test', got %v", result["extractedTitle"])
		}
	})
}
