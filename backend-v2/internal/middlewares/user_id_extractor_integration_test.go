package middlewares_test

import (
	"backend-v2/internal/middlewares"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func TestUserIDExtractor_PublicRoute_NoToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	app.Post("/api/v2/auth/signup", extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("signup successful")
	})

	req := httptest.NewRequest("POST", "/api/v2/auth/signup", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Status code = %d, want 200 (should allow public route without token)",
			resp.StatusCode)
	}
}

func TestUserIDExtractor_PublicRoute_WithInvalidToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	app.Post("/api/v2/auth/login", extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("login successful")
	})

	req := httptest.NewRequest("POST", "/api/v2/auth/login", nil)
	req.Header.Set("Cookie", "auth=invalid.jwt.token")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Status code = %d, want 200 (public route should skip JWT validation)",
			resp.StatusCode)
	}
}

func TestUserIDExtractor_PublicRoute_AllAuthEndpoints(t *testing.T) {
	authEndpoints := []struct {
		method string
		path   string
	}{
		{"POST", "/api/v2/auth/signup"},
		{"POST", "/api/v2/auth/login"},
		{"POST", "/api/v2/auth/login-jwt"},
		{"POST", "/api/v2/auth/logout"},
		{"POST", "/api/v2/auth/refresh"},
		{"POST", "/api/v2/auth/forgot-password"},
		{"POST", "/api/v2/auth/reset-password/token123"},
		{"GET", "/api/v2/auth/check-reset-token/token123"},
	}

	for _, endpoint := range authEndpoints {
		t.Run(endpoint.path, func(t *testing.T) {
			app := fiber.New()
			extractor := middlewares.CreateUserIDExtractor()

			app.Add(endpoint.method, endpoint.path, extractor.Handle, func(c *fiber.Ctx) error {
				return c.SendString("ok")
			})

			req := httptest.NewRequest(endpoint.method, endpoint.path, nil)
			req.Header.Set("Cookie", "auth=stale.invalid.token")

			resp, err := app.Test(req, -1)
			if err != nil {
				t.Fatalf("Test request failed: %v", err)
			}

			if resp.StatusCode != 200 {
				t.Errorf("Status code = %d, want 200 for public auth route %s",
					resp.StatusCode, endpoint.path)
			}
		})
	}
}

func TestUserIDExtractor_ProtectedRoute_NoToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", middlewares.JWTErrorMissingToken)
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("workflow data")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Status code = %d, want 200 (missing token is allowed for optional auth)",
			resp.StatusCode)
	}
}

func TestUserIDExtractor_ProtectedRoute_InvalidSignature(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", "signature is invalid")
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("workflow data")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 401 {
		t.Errorf("Status code = %d, want 401 for invalid signature", resp.StatusCode)
	}
}

func TestUserIDExtractor_ProtectedRoute_ValidToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		claims := jwt.MapClaims{
			"sub":   "user123",
			"roles": []interface{}{"admin", "subscriber"},
		}
		c.Locals("auth", claims)
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		userID := c.Locals("userId")
		if userID != "user123" {
			t.Errorf("UserID = %v, want %q", userID, "user123")
		}

		roles := c.Locals("roles")
		roleSlice, ok := roles.([]string)
		if !ok || len(roleSlice) != 2 {
			t.Errorf("Roles = %v, want [admin, subscriber]", roles)
		}

		return c.SendString("workflow data")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Status code = %d, want 200 for valid token", resp.StatusCode)
	}
}

func TestUserIDExtractor_ProtectedRoute_TokenExpired(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", "token is expired")
		return c.Next()
	}

	app.Get("/api/v2/template", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("template data")
	})

	req := httptest.NewRequest("GET", "/api/v2/template", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 401 {
		t.Errorf("Status code = %d, want 401 for expired token", resp.StatusCode)
	}
}

func TestUserIDExtractor_ProtectedRoute_MalformedToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", "token is malformed")
		return c.Next()
	}

	app.Get("/api/v2/user", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("user data")
	})

	req := httptest.NewRequest("GET", "/api/v2/user", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 401 {
		t.Errorf("Status code = %d, want 401 for malformed token", resp.StatusCode)
	}
}

func TestUserIDExtractor_ProductionScenario_StaleTokenOnSignup(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	jwtMiddleware := func(c *fiber.Ctx) error {
		cookie := c.Cookies("auth")
		if cookie != "" {
			c.Locals("jwtOriginalError", "signature is invalid")
		}
		return c.Next()
	}

	app.Post("/api/v2/auth/signup", jwtMiddleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"success": true})
	})

	req := httptest.NewRequest("POST", "/api/v2/auth/signup", nil)
	req.Header.Set("Cookie", "auth=stale.token.from.different.secret")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}

	if resp.StatusCode != 200 {
		t.Errorf("Status code = %d, want 200 (public signup should work with stale cookie)",
			resp.StatusCode)
	}
}

func TestUserIDExtractor_EdgeCase_EmptyUserID(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		claims := jwt.MapClaims{
			"sub":   "",
			"roles": []interface{}{"subscriber"},
		}
		c.Locals("auth", claims)
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		userID := c.Locals("userId")
		if userID != nil && userID != "" {
			t.Errorf("UserID should be nil or empty for empty sub, got %v", userID)
		}
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestUserIDExtractor_EdgeCase_NoRolesInToken(t *testing.T) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		claims := jwt.MapClaims{
			"sub": "user123",
		}
		c.Locals("auth", claims)
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		userID := c.Locals("userId")
		if userID != "user123" {
			t.Errorf("UserID = %v, want %q", userID, "user123")
		}

		roles := c.Locals("roles")
		if roles != nil {
			t.Errorf("Roles = %v, want nil when not present in token", roles)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func BenchmarkUserIDExtractor_PublicRoute(b *testing.B) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	app.Post("/api/v2/auth/signup", extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("POST", "/api/v2/auth/signup", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req, -1)
	}
}

func BenchmarkUserIDExtractor_ProtectedRoute(b *testing.B) {
	app := fiber.New()
	extractor := middlewares.CreateUserIDExtractor()

	middleware := func(c *fiber.Ctx) error {
		claims := jwt.MapClaims{
			"sub":   "user123",
			"roles": []interface{}{"admin"},
		}
		c.Locals("auth", claims)
		return c.Next()
	}

	app.Get("/api/v2/workflow", middleware, extractor.Handle, func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/api/v2/workflow", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req, -1)
	}
}
