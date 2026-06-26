package config

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

var BuildVersion = "dev"

var (
	Port          string
	MongoUsername string
	MongoPassword string
	MongoDatabase string
	MongoHost     string
	MongoPort     string
	JwtSecret     string
	MongoURI      string
	SyncUserID    string
	ApiRoot       string
)

func init() {
	_ = godotenv.Load(".env")

	BuildVersion = overrideVersionFromEnv(BuildVersion, os.Getenv("BUILD_VERSION"))

	Port = getEnv("PORT", "8080")
	MongoUsername = getEnv("MONGO_USERNAME", "delta5")
	MongoPassword = getEnv("MONGO_PASSWORD", "")
	MongoDatabase = getEnv("MONGO_DATABASE", "delta5")
	MongoHost = getEnv("MONGO_HOST", "localhost")
	MongoPort = getEnv("MONGO_PORT", "27017")
	JwtSecret = getEnv("JWT_SECRET", "test-jwt-secret-change-in-production")
	SyncUserID = getEnv("SYNC_USER_ID", "wp-sync-user")
	ApiRoot = getEnv("API_ROOT", "/")

	if envMongoURI := os.Getenv("MONGO_URI"); envMongoURI != "" {
		MongoURI = envMongoURI
		if os.Getenv("MONGO_DATABASE") == "" {
			if db := databaseFromURI(envMongoURI); db != "" {
				MongoDatabase = db
			}
		}
	} else {
		auth := ""
		if MongoPassword != "" {
			auth = fmt.Sprintf("%s:%s@", MongoUsername, MongoPassword)
		}
		MongoURI = fmt.Sprintf("mongodb://%s%s:%s", auth, MongoHost, MongoPort)
	}

	log.Printf("CONFIGURATION:\n")
	log.Printf("PORT=%s", Port)
	log.Printf("API_ROOT=%s", ApiRoot)
	log.Printf("MONGO_USERNAME=%s", MongoUsername)
	log.Printf("MONGO_DATABASE=%s", MongoDatabase)
	log.Printf("MONGO_HOST=%s", MongoHost)
	log.Printf("MONGO_PORT=%s", MongoPort)
	log.Printf("MONGO_URI=%s", MongoURI)
}

func databaseFromURI(rawURI string) string {
	parsed, err := url.Parse(rawURI)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(parsed.Path, "/"))
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// "dev" signals no SHA was injected at link time; only then does the env override apply.
func overrideVersionFromEnv(current, envValue string) string {
	if envValue != "" && current == "dev" {
		return envValue
	}
	return current
}
