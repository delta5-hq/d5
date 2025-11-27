package config

import (
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

var (
	Port             string
	MongoUsername    string
	MongoPassword    string
	MongoDatabase    string
	MongoHost        string
	MongoPort        string
	JwtSecret        string
	MongoURI         string
	SyncUserID       string
	ApiRoot          string
)

func init() {
	godotenv.Load(".env")

	Port = getEnv("PORT", "8080")
	MongoUsername = getEnv("MONGO_USERNAME", "delta5")
	MongoPassword = getEnv("MONGO_PASSWORD", "")
	MongoDatabase = getEnv("MONGO_DATABASE", "delta5")
	MongoHost = getEnv("MONGO_HOST", "localhost")
	MongoPort = getEnv("MONGO_PORT", "27017")
	JwtSecret = getEnv("JWT_SECRET", "GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO")
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

	log.Printf("CONFIGURATION:\n")
	log.Printf("PORT=%s", Port)
	log.Printf("API_ROOT=%s", ApiRoot)
	log.Printf("MONGO_USERNAME=%s", MongoUsername)
	log.Printf("MONGO_DATABASE=%s", MongoDatabase)
	log.Printf("MONGO_HOST=%s", MongoHost)
	log.Printf("MONGO_PORT=%s", MongoPort)
	log.Printf("MONGO_URI=%s", MongoURI)
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
