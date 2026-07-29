package config

import (
	"fmt"
	"net/url"
	"os"

	"github.com/joho/godotenv"
)

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

	Port = getEnv("PORT", "8080")
	MongoUsername = getEnv("MONGO_USERNAME", "delta5")
	MongoPassword = getEnv("MONGO_PASSWORD", "")
	MongoHost = getEnv("MONGO_HOST", "localhost")
	MongoPort = getEnv("MONGO_PORT", "27017")
	JwtSecret = getEnv("JWT_SECRET", "test-jwt-secret-change-in-production")
	SyncUserID = getEnv("SYNC_USER_ID", "wp-sync-user")
	ApiRoot = getEnv("API_ROOT", "/")

	if envMongoURI := os.Getenv("MONGO_URI"); envMongoURI != "" {
		MongoURI = envMongoURI
	} else {
		auth := ""
		if MongoPassword != "" {
			auth = fmt.Sprintf("%s:%s@", MongoUsername, MongoPassword)
		}
		MongoURI = fmt.Sprintf("mongodb://%s%s:%s", auth, MongoHost, MongoPort)
	}

	MongoDatabase = resolveMongoDatabase(getEnv("MONGO_DATABASE", ""), MongoURI)

}

const defaultDatabase = "delta5"

func resolveMongoDatabase(envDB, mongoURI string) string {
	if envDB != "" {
		return envDB
	}
	return dbNameFromURI(mongoURI)
}

func dbNameFromURI(mongoURI string) string {
	parsed, err := url.Parse(mongoURI)
	if err != nil {
		return defaultDatabase
	}
	if name := parsed.Path; len(name) > 1 {
		return name[1:]
	}
	return defaultDatabase
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
