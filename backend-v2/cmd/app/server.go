package main

import (
	"fmt"
	"log"

	"backend-v2/internal/config"
	"backend-v2/internal/database"
	"backend-v2/internal/modules/router"

	"github.com/gofiber/fiber/v2"
)

func main() {
	cfg := config.Load()
	app := fiber.New()
	fmt.Println(cfg)
	db := database.Connect(cfg.MongoURI, cfg.MongoDatabase)
	defer database.Disconnect()

	router.RegisterRoutes(app, db)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Fatal(app.Listen(addr))
}
