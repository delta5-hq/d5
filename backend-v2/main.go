package main

import (
	"os"

	"backend-v2/internal/common/checkedlog"
	"backend-v2/internal/config"
	"backend-v2/internal/database"
	"backend-v2/internal/modules/router"
	"backend-v2/internal/services/container"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
)

func main() {
	if err := checkedlog.ConfigureDefaultFromEnv(); err != nil {
		checkedlog.EmitStartupFailureToStderr()
		os.Exit(1)
	}
	checkedlog.Infof("PORT=%s API_ROOT=%s MONGO_HOST=%s MONGO_PORT=%s MONGO_DATABASE=%s MONGO_USERNAME=%s",
		config.Port, config.ApiRoot, config.MongoHost, config.MongoPort, config.MongoDatabase, config.MongoUsername)

	db := database.Connect(config.MongoURI, config.MongoDatabase)
	defer database.Disconnect()

	/* Instantiate service container based on environment */
	useMockServices := os.Getenv("MOCK_EXTERNAL_SERVICES") == "true"
	serviceContainer := container.NewServiceContainer(useMockServices, db)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	// add basic middleware
	app.Use(checkedlog.RequestLogger())
	app.Use(recover.New())
	app.Use(cors.New())
	// add routes
	if err := router.RegisterRoutes(app, db, serviceContainer); err != nil {
		checkedlog.EmitStartupFailureToStderr()
		os.Exit(1)
	}
	// Custom 404 handler
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).SendString("Not Found")
	})

	// start server
	if err := app.Listen(":" + config.Port); err != nil {
		checkedlog.Fatalf("server listen failed: %v", err)
	}
}
