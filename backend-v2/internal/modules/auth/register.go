package auth

import (
	"backend-v2/internal/services/email"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func RegisterRoutes(router fiber.Router, db *qmgo.Database, emailService email.Service) {
	usersCollection := db.Collection("users")
	waitlistCollection := db.Collection("waitlists")
	
	service := NewService(usersCollection, waitlistCollection)
	controller := NewController(service, emailService)

	/* RESTful auth routes under /auth namespace */
	router.Post("/auth/signup", controller.Signup)
	router.Post("/auth/login", controller.Login)
	router.Post("/auth/login-jwt", controller.LoginJWT)
	router.Post("/auth/logout", controller.Logout)
	router.Post("/auth/refresh", controller.Refresh)
	router.Post("/auth/forgot-password", controller.ForgotPassword)
	router.Get("/auth/check-reset-token/:pwdResetToken", controller.CheckResetToken)
	router.Post("/auth/reset-password/:pwdResetToken", controller.ResetPassword)

	/* Backward compatibility aliases (deprecated) */
	router.Post("/auth", controller.Login)                  // Legacy: Use /auth/login
	router.Post("/external-auth", controller.LoginJWT)      // Legacy: Use /auth/login-jwt
	router.Post("/external-auth/refresh", controller.Refresh) // Legacy: Use /auth/refresh
	router.Post("/refresh", controller.Refresh)             // Legacy: Use /auth/refresh
	router.Get("/auth/login", func(c *fiber.Ctx) error {    // Legacy GET handler
		return c.JSON(fiber.Map{"redirect": false})
	})
}
