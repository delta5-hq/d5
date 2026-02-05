package progress

import (
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestRegisterRoutes(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v2")

	RegisterRoutes(api)

	routes := app.Stack()

	var foundRoute bool
	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/api/v2/progress/stream") {
				foundRoute = true
				break
			}
		}
		if foundRoute {
			break
		}
	}

	if !foundRoute {
		t.Error("Progress stream route not registered")
	}
}

func TestRegisterRoutes_OnlyGETAllowed(t *testing.T) {
	app := fiber.New()
	api := app.Group("/api/v2")

	RegisterRoutes(api)

	routes := app.Stack()

	var getFound, postFound, putFound, deleteFound bool
	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/api/v2/progress/stream") {
				switch route.Method {
				case "GET":
					getFound = true
				case "POST":
					postFound = true
				case "PUT":
					putFound = true
				case "DELETE":
					deleteFound = true
				}
			}
		}
	}

	if !getFound {
		t.Error("GET method not registered for progress stream")
	}
	if postFound {
		t.Error("POST method should not be registered for progress stream")
	}
	if putFound {
		t.Error("PUT method should not be registered for progress stream")
	}
	if deleteFound {
		t.Error("DELETE method should not be registered for progress stream")
	}
}
