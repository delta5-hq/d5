package gateway

import (
	"os"
)

type Config struct {
	NodeJSBackendURL string
	NodeJSAPIRoot    string
}

func NewConfig() *Config {
	return &Config{
		NodeJSBackendURL: getEnv("NODEJS_BACKEND_URL", "http://localhost:3001"),
		NodeJSAPIRoot:    getEnv("NODEJS_API_ROOT", "/api/v1"),
	}
}

func (c *Config) BuildURL(path string) string {
	return c.NodeJSBackendURL + c.NodeJSAPIRoot + path
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
