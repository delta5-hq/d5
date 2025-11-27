package gateway

import (
	"os"
	"testing"
)

func TestNewConfig(t *testing.T) {
	tests := []struct {
		name                string
		envNodeJSBackendURL string
		envNodeJSAPIRoot    string
		wantBackendURL      string
		wantAPIRoot         string
	}{
		{
			name:                "default values when env vars not set",
			envNodeJSBackendURL: "",
			envNodeJSAPIRoot:    "",
			wantBackendURL:      "http://localhost:3001",
			wantAPIRoot:         "/api/v1",
		},
		{
			name:                "custom backend URL",
			envNodeJSBackendURL: "http://backend-service:8080",
			envNodeJSAPIRoot:    "",
			wantBackendURL:      "http://backend-service:8080",
			wantAPIRoot:         "/api/v1",
		},
		{
			name:                "custom API root",
			envNodeJSBackendURL: "",
			envNodeJSAPIRoot:    "/api/v2",
			wantBackendURL:      "http://localhost:3001",
			wantAPIRoot:         "/api/v2",
		},
		{
			name:                "both custom values",
			envNodeJSBackendURL: "https://production.example.com",
			envNodeJSAPIRoot:    "/services/api",
			wantBackendURL:      "https://production.example.com",
			wantAPIRoot:         "/services/api",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envNodeJSBackendURL != "" {
				os.Setenv("NODEJS_BACKEND_URL", tt.envNodeJSBackendURL)
				defer os.Unsetenv("NODEJS_BACKEND_URL")
			} else {
				os.Unsetenv("NODEJS_BACKEND_URL")
			}

			if tt.envNodeJSAPIRoot != "" {
				os.Setenv("NODEJS_API_ROOT", tt.envNodeJSAPIRoot)
				defer os.Unsetenv("NODEJS_API_ROOT")
			} else {
				os.Unsetenv("NODEJS_API_ROOT")
			}

			config := NewConfig()

			if config.NodeJSBackendURL != tt.wantBackendURL {
				t.Errorf("NewConfig() NodeJSBackendURL = %v, want %v", config.NodeJSBackendURL, tt.wantBackendURL)
			}

			if config.NodeJSAPIRoot != tt.wantAPIRoot {
				t.Errorf("NewConfig() NodeJSAPIRoot = %v, want %v", config.NodeJSAPIRoot, tt.wantAPIRoot)
			}
		})
	}
}

func TestConfig_BuildURL(t *testing.T) {
	tests := []struct {
		name       string
		backendURL string
		apiRoot    string
		path       string
		want       string
	}{
		{
			name:       "simple path",
			backendURL: "http://localhost:3001",
			apiRoot:    "/api/v1",
			path:       "/execute",
			want:       "http://localhost:3001/api/v1/execute",
		},
		{
			name:       "nested path",
			backendURL: "http://localhost:3001",
			apiRoot:    "/api/v1",
			path:       "/integration/scrape_v2",
			want:       "http://localhost:3001/api/v1/integration/scrape_v2",
		},
		{
			name:       "custom backend URL",
			backendURL: "https://backend.production.com",
			apiRoot:    "/api/v1",
			path:       "/execute",
			want:       "https://backend.production.com/api/v1/execute",
		},
		{
			name:       "custom API root",
			backendURL: "http://localhost:3001",
			apiRoot:    "/services",
			path:       "/execute",
			want:       "http://localhost:3001/services/execute",
		},
		{
			name:       "path with query parameters",
			backendURL: "http://localhost:3001",
			apiRoot:    "/api/v1",
			path:       "/search?q=test",
			want:       "http://localhost:3001/api/v1/search?q=test",
		},
		{
			name:       "empty path",
			backendURL: "http://localhost:3001",
			apiRoot:    "/api/v1",
			path:       "",
			want:       "http://localhost:3001/api/v1",
		},
		{
			name:       "root path",
			backendURL: "http://localhost:3001",
			apiRoot:    "/api/v1",
			path:       "/",
			want:       "http://localhost:3001/api/v1/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &Config{
				NodeJSBackendURL: tt.backendURL,
				NodeJSAPIRoot:    tt.apiRoot,
			}

			got := config.BuildURL(tt.path)
			if got != tt.want {
				t.Errorf("BuildURL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		fallback string
		envValue string
		setEnv   bool
		want     string
	}{
		{
			name:     "returns env value when set",
			key:      "TEST_KEY",
			fallback: "default",
			envValue: "custom",
			setEnv:   true,
			want:     "custom",
		},
		{
			name:     "returns fallback when env not set",
			key:      "TEST_KEY",
			fallback: "default",
			envValue: "",
			setEnv:   false,
			want:     "default",
		},
		{
			name:     "returns fallback when env empty string",
			key:      "TEST_KEY",
			fallback: "default",
			envValue: "",
			setEnv:   true,
			want:     "default",
		},
		{
			name:     "empty fallback",
			key:      "TEST_KEY",
			fallback: "",
			envValue: "",
			setEnv:   false,
			want:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setEnv {
				os.Setenv(tt.key, tt.envValue)
				defer os.Unsetenv(tt.key)
			} else {
				os.Unsetenv(tt.key)
			}

			got := getEnv(tt.key, tt.fallback)
			if got != tt.want {
				t.Errorf("getEnv() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestConfig_ConcurrentBuildURL(t *testing.T) {
	config := &Config{
		NodeJSBackendURL: "http://localhost:3001",
		NodeJSAPIRoot:    "/api/v1",
	}

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(index int) {
			url := config.BuildURL("/execute")
			expected := "http://localhost:3001/api/v1/execute"
			if url != expected {
				t.Errorf("Concurrent BuildURL() = %v, want %v", url, expected)
			}
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
