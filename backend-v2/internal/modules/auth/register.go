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

	// Public routes (no middleware)
	router.Post("/auth/signup", controller.Signup)
	router.Post("/auth", controller.Auth)
	router.Get("/auth/login", controller.Login)
	router.Post("/auth/logout", controller.Logout)
	router.Post("/auth/forgot-password", controller.ForgotPassword)
	router.Get("/auth/check-reset-token/:pwdResetToken", controller.CheckResetToken)
	router.Post("/auth/reset-password/:pwdResetToken", controller.ResetPassword)
	router.Post("/refresh", controller.Refresh)
	router.Post("/auth/refresh", controller.Refresh)
	router.Post("/external-auth", controller.ExternalAuth)
	router.Post("/external-auth/refresh", controller.ExternalRefresh)
}
