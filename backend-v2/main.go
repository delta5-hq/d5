package main

import (
	"log"

	"backend-v2/internal/config"
	"backend-v2/internal/database"
	"backend-v2/internal/modules/router"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	db := database.Connect(config.MongoURI, config.MongoDatabase)
	defer database.Disconnect()

	app := fiber.New()
	// add basic middleware
	app.Use(logger.New())
	app.Use(recover.New())
	app.Use(cors.New())
	// add routes
	router.RegisterRoutes(app, db)

	// Custom 404 handler
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).SendString("Not Found")
	})

	// start server
	log.Fatal(app.Listen(":" + config.Port))
}
