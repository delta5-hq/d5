package user

import (
	"backend-v2/internal/middlewares"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(api fiber.Router, db *qmgo.Database) {
	service := NewService(db)
	controller := NewController(service)

	/* Administrator-only endpoint for testing RBAC */
	api.Get("/user", middlewares.RequireAuth, controller.AdminOnly)

	/* User search routes */
	api.Get("/users/search", middlewares.ExtractUserID, controller.Search)
	api.Get("/users/search/mail", middlewares.ExtractUserID, controller.SearchMail)
	api.Get("/users/current", middlewares.RequireAuth, controller.Current)

	/* User management routes */
	api.Delete("/users/:userId", middlewares.RequireAuth, controller.DeleteUser)

	/* Backward compatibility alias (deprecated) */
	api.Get("/users/me", middlewares.RequireAuth, controller.Current)
}
