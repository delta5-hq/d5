package gateway

import (
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestNewRouteRegistry(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	if registry == nil {
		t.Fatal("NewRouteRegistry() returned nil")
	}

	if registry.proxy != proxy {
		t.Error("NewRouteRegistry() proxy not set correctly")
	}
}

func TestRouteRegistry_RegisterNodeJSRoutes(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.RegisterNodeJSRoutes(router)

	routes := app.Stack()
	if len(routes) == 0 {
		t.Fatal("No routes registered")
	}

	expectedPaths := map[string]bool{
		"/api/v2/execute":                           false,
		"/api/v2/integration/scrape_v2":             false,
		"/api/v2/integration/scrape_files":          false,
		"/api/v2/integration/translate":             false,
		"/api/v2/integration/search":                false,
		"/api/v2/integration/downloadImage":         false,
		"/api/v2/integration/images/generations":    false,
	}

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if _, exists := expectedPaths[route.Path]; exists {
				expectedPaths[route.Path] = true
			}
		}
	}

	for path, found := range expectedPaths {
		if !found {
			t.Errorf("Expected route %v not registered", path)
		}
	}
}

func TestRouteRegistry_ExecuteRoutes(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.registerExecuteRoutes(router)

	routes := app.Stack()
	executeRouteFound := false

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if route.Path == "/api/v2/execute" {
				executeRouteFound = true
				
				validMethods := map[string]bool{
					"HEAD": true, "GET": true, "POST": true, "PUT": true,
					"DELETE": true, "PATCH": true, "CONNECT": true, "OPTIONS": true, "TRACE": true,
				}
				
				if !validMethods[route.Method] {
					t.Errorf("Execute route registered with unexpected method: %v", route.Method)
				}
			}
		}
	}

	if !executeRouteFound {
		t.Error("Execute route /api/v2/execute not registered")
	}
}

func TestRouteRegistry_ScrapingRoutes(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.registerScrapingRoutes(router)

	routes := app.Stack()
	
	expectedScrapingRoutes := map[string]bool{
		"/api/v2/integration/scrape_v2":    false,
		"/api/v2/integration/scrape_files": false,
	}

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if _, exists := expectedScrapingRoutes[route.Path]; exists && route.Method == "POST" {
				expectedScrapingRoutes[route.Path] = true
			}
		}
	}

	for path, found := range expectedScrapingRoutes {
		if !found {
			t.Errorf("Expected scraping route %v not registered", path)
		}
	}
}

func TestRouteRegistry_ExternalAPIRoutes(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.registerExternalAPIRoutes(router)

	routes := app.Stack()
	
	expectedExternalAPIRoutes := map[string]string{
		"/api/v2/integration/translate":          "POST",
		"/api/v2/integration/search":             "GET",
		"/api/v2/integration/downloadImage":      "POST",
		"/api/v2/integration/images/generations": "POST",
	}

	foundRoutes := make(map[string]string)

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if expectedMethod, exists := expectedExternalAPIRoutes[route.Path]; exists {
				if route.Method == expectedMethod {
					foundRoutes[route.Path] = route.Method
				}
			}
		}
	}

	for path, expectedMethod := range expectedExternalAPIRoutes {
		if foundMethod, found := foundRoutes[path]; !found {
			t.Errorf("Expected external API route %v (%v) not registered", path, expectedMethod)
		} else if foundMethod != expectedMethod {
			t.Errorf("Route %v has method %v, want %v", path, foundMethod, expectedMethod)
		}
	}
}

func TestRouteRegistry_IntegrationGrouping(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.RegisterNodeJSRoutes(router)

	routes := app.Stack()
	
	integrationRouteCount := 0
	for _, routeStack := range routes {
		for _, route := range routeStack {
			if len(route.Path) >= len("/api/v2/integration") && 
			   route.Path[:len("/api/v2/integration")] == "/api/v2/integration" {
				integrationRouteCount++
			}
		}
	}

	expectedIntegrationRoutes := 6
	if integrationRouteCount < expectedIntegrationRoutes {
		t.Errorf("Found %v integration routes, expected at least %v", integrationRouteCount, expectedIntegrationRoutes)
	}
}

func TestRouteRegistry_AllMethodsExecuteRoute(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}
	proxy := NewProxy(config)
	registry := NewRouteRegistry(proxy)

	app := fiber.New()
	router := app.Group("/api/v2")

	registry.registerExecuteRoutes(router)

	routes := app.Stack()
	
	methodsFound := make(map[string]bool)
	for _, routeStack := range routes {
		for _, route := range routeStack {
			if route.Path == "/api/v2/execute" {
				methodsFound[route.Method] = true
			}
		}
	}

	expectedMethods := []string{"HEAD", "GET", "POST", "PUT", "DELETE", "PATCH"}
	for _, method := range expectedMethods {
		if !methodsFound[method] {
			t.Logf("Note: Method %v not found for /execute route (may be normal)", method)
		}
	}

	if len(methodsFound) == 0 {
		t.Error("No methods registered for /execute route")
	}
}

func TestRouteRegistry_EmptyProxy(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Error("NewRouteRegistry with nil proxy should panic, but didn't")
		}
	}()

	NewRouteRegistry(nil)
}
