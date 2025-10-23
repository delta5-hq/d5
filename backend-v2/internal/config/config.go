package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port          string
	MongoUsername string
	MongoPassword string
	MongoDatabase string
	MongoHost     string
	MongoPort     string
	MongoURI      string
}

func Load() *Config {
	cfg := &Config{
		Port:          getEnv("PORT", "8080"),
		MongoUsername: getEnv("MONGO_USERNAME", "delta5"),
		MongoPassword: getEnv("MONGO_PASSWORD", ""),
		MongoDatabase: getEnv("MONGO_DATABASE", "delta5"),
		MongoHost:     getEnv("MONGO_HOST", "localhost"),
		MongoPort:     getEnv("MONGO_PORT", "27017"),
	}

	var mongoAuth string
	if cfg.MongoPassword != "" {
		mongoAuth = fmt.Sprintf("%s:%s@", cfg.MongoUsername, cfg.MongoPassword)
	} else {
		mongoAuth = ""
	}

	cfg.MongoURI = fmt.Sprintf(
		"mongodb://%s%s:%s",
		mongoAuth, cfg.MongoHost, cfg.MongoPort,
	)

	return cfg
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
