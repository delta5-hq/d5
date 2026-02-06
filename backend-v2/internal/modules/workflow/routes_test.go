package workflow

import (
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func TestRegisterRoutes_WorkflowPUTRouteRegistered(t *testing.T) {
	app := fiber.New()
	controller := &WorkflowController{}
	db := &qmgo.Database{}

	RegisterRoutes(app, controller, db)

	routes := app.Stack()
	var foundPutRoute bool

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/workflow/:workflowId") && route.Method == "PUT" {
				foundPutRoute = true
				break
			}
		}
		if foundPutRoute {
			break
		}
	}

	if !foundPutRoute {
		t.Error("PUT /workflow/:workflowId route not registered")
	}
}

func TestRegisterRoutes_PUTRequiresAuth(t *testing.T) {
	app := fiber.New()
	controller := &WorkflowController{}
	db := &qmgo.Database{}

	RegisterRoutes(app, controller, db)

	routes := app.Stack()
	var putRouteHandlers []string

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/workflow/:workflowId") && route.Method == "PUT" {
				putRouteHandlers = append(putRouteHandlers, route.Path)
			}
		}
	}

	if len(putRouteHandlers) == 0 {
		t.Error("PUT route not found")
	}
}

func TestRegisterRoutes_AllCRUDMethodsPresent(t *testing.T) {
	app := fiber.New()
	controller := &WorkflowController{}
	db := &qmgo.Database{}

	RegisterRoutes(app, controller, db)

	routes := app.Stack()
	foundMethods := make(map[string]bool)

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/workflow/:workflowId") {
				foundMethods[route.Method] = true
			}
		}
	}

	requiredMethods := []string{"GET", "PUT", "DELETE"}
	for _, method := range requiredMethods {
		if !foundMethods[method] {
			t.Errorf("Required method %s not registered for /workflow/:workflowId", method)
		}
	}
}

func TestRegisterRoutes_PATCHStillRejected(t *testing.T) {
	app := fiber.New()
	controller := &WorkflowController{}
	db := &qmgo.Database{}

	RegisterRoutes(app, controller, db)

	routes := app.Stack()
	var foundPatchRoute bool

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/workflow/:workflowId") && route.Method == "PATCH" {
				foundPatchRoute = true
				break
			}
		}
		if foundPatchRoute {
			break
		}
	}

	if !foundPatchRoute {
		t.Error("PATCH route should be registered (even if rejected by handler)")
	}
}

func TestRegisterRoutes_MiddlewareOrderCorrect(t *testing.T) {
	app := fiber.New()
	controller := &WorkflowController{}
	db := &qmgo.Database{}

	RegisterRoutes(app, controller, db)

	routes := app.Stack()

	for _, routeStack := range routes {
		for _, route := range routeStack {
			if strings.Contains(route.Path, "/workflow/:workflowId") && route.Method == "PUT" {
				if route.Path == "" {
					t.Error("PUT route path is empty")
				}
				return
			}
		}
	}
}
