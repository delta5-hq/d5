package middlewares_test

import (
	"backend-v2/internal/middlewares"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func TestContextStorage_StoreAndRetrieveUserID(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		storage.StoreUserID(c, "user123")

		storedValue := c.Locals("userId")
		if storedValue != "user123" {
			t.Errorf("Stored userId = %v, want %q", storedValue, "user123")
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_StoreAndRetrieveRoles(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		roles := []string{"admin", "subscriber"}
		storage.StoreRoles(c, roles)

		storedValue := c.Locals("roles")
		storedRoles, ok := storedValue.([]string)
		if !ok {
			t.Error("Stored roles not of type []string")
			return c.SendString("error")
		}

		if len(storedRoles) != 2 {
			t.Errorf("Stored roles length = %d, want 2", len(storedRoles))
		}

		if storedRoles[0] != "admin" || storedRoles[1] != "subscriber" {
			t.Errorf("Stored roles = %v, want [admin, subscriber]", storedRoles)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_ClearUserID(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		storage.StoreUserID(c, "user123")

		value := c.Locals("userId")
		if value != "user123" {
			t.Error("UserID not stored correctly before clear")
		}

		storage.ClearUserID(c)

		clearedValue := c.Locals("userId")
		if clearedValue != nil {
			t.Errorf("ClearUserID() result = %v, want nil", clearedValue)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetJWTError_NoError(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		errMsg := storage.GetJWTError(c)

		if errMsg != middlewares.JWTErrorNone {
			t.Errorf("GetJWTError() = %q, want %q", errMsg, middlewares.JWTErrorNone)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetJWTError_WithError(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", "signature is invalid")

		errMsg := storage.GetJWTError(c)

		if errMsg != "signature is invalid" {
			t.Errorf("GetJWTError() = %q, want %q", errMsg, "signature is invalid")
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetJWTError_WrongType(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		c.Locals("jwtOriginalError", 12345)

		errMsg := storage.GetJWTError(c)

		if errMsg != middlewares.JWTErrorNone {
			t.Errorf("GetJWTError() with wrong type = %q, want %q",
				errMsg, middlewares.JWTErrorNone)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetAuthClaims_Exists(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		expectedClaims := jwt.MapClaims{
			"sub":   "user123",
			"roles": []interface{}{"admin"},
		}
		c.Locals("auth", expectedClaims)

		claims, exists := storage.GetAuthClaims(c)

		if !exists {
			t.Error("GetAuthClaims() exists = false, want true")
		}

		if claims["sub"] != "user123" {
			t.Errorf("GetAuthClaims() sub = %v, want %q", claims["sub"], "user123")
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetAuthClaims_Missing(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		claims, exists := storage.GetAuthClaims(c)

		if exists {
			t.Error("GetAuthClaims() exists = true, want false when not set")
		}

		if claims != nil {
			t.Errorf("GetAuthClaims() claims = %v, want nil", claims)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_GetAuthClaims_WrongType(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		c.Locals("auth", "not-a-claims-object")

		claims, exists := storage.GetAuthClaims(c)

		if exists {
			t.Error("GetAuthClaims() exists = true, want false for wrong type")
		}

		if claims != nil {
			t.Errorf("GetAuthClaims() claims = %v, want nil for wrong type", claims)
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func TestContextStorage_MultipleOperations(t *testing.T) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		storage.StoreUserID(c, "user1")
		storage.StoreRoles(c, []string{"admin"})

		c.Locals("jwtOriginalError", "some error")
		c.Locals("auth", jwt.MapClaims{"sub": "user1"})

		userID := c.Locals("userId")
		if userID != "user1" {
			t.Errorf("UserID = %v, want %q", userID, "user1")
		}

		roles := c.Locals("roles")
		if rolesSlice, ok := roles.([]string); !ok || len(rolesSlice) != 1 {
			t.Errorf("Roles = %v, want [admin]", roles)
		}

		errMsg := storage.GetJWTError(c)
		if errMsg != "some error" {
			t.Errorf("JWT Error = %q, want %q", errMsg, "some error")
		}

		claims, exists := storage.GetAuthClaims(c)
		if !exists || claims["sub"] != "user1" {
			t.Error("Auth claims not retrieved correctly")
		}

		storage.ClearUserID(c)
		if c.Locals("userId") != nil {
			t.Error("UserID not cleared")
		}

		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)
	_, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Test request failed: %v", err)
	}
}

func BenchmarkContextStorage_StoreUserID(b *testing.B) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		storage.StoreUserID(c, "user123")
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req, -1)
	}
}

func BenchmarkContextStorage_GetAuthClaims(b *testing.B) {
	app := fiber.New()
	storage := middlewares.NewContextStorage()

	app.Get("/test", func(c *fiber.Ctx) error {
		c.Locals("auth", jwt.MapClaims{"sub": "user123"})
		_, _ = storage.GetAuthClaims(c)
		return c.SendString("ok")
	})

	req := httptest.NewRequest("GET", "/test", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req, -1)
	}
}
