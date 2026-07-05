package config

import (
	"os"
	"testing"
)

const testEnvKey = "TEST_CONFIG_GETENV"

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		setEnv   bool
		envValue string
		fallback string
		want     string
	}{
		{
			name:     "set non-empty value is returned as-is",
			setEnv:   true,
			envValue: "explicit-value",
			fallback: "fallback",
			want:     "explicit-value",
		},
		{
			name:     "unset key returns fallback",
			setEnv:   false,
			fallback: "fallback",
			want:     "fallback",
		},
		{
			name:     "empty string is treated as unset and returns fallback",
			setEnv:   true,
			envValue: "",
			fallback: "fallback",
			want:     "fallback",
		},
		{
			name:     "empty fallback with unset key returns empty string",
			setEnv:   false,
			fallback: "",
			want:     "",
		},
		{
			name:     "empty fallback with empty env value returns empty string",
			setEnv:   true,
			envValue: "",
			fallback: "",
			want:     "",
		},
		{
			name:     "whitespace-only value is returned without trimming",
			setEnv:   true,
			envValue: "  ",
			fallback: "fallback",
			want:     "  ",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.Unsetenv(testEnvKey)
			t.Cleanup(func() { os.Unsetenv(testEnvKey) })
			if tt.setEnv {
				t.Setenv(testEnvKey, tt.envValue)
			}

			got := getEnv(testEnvKey, tt.fallback)

			if got != tt.want {
				t.Errorf("getEnv(%q, %q) = %q, want %q", testEnvKey, tt.fallback, got, tt.want)
			}
		})
	}
}

func TestDbNameFromURI(t *testing.T) {
	tests := []struct {
		name string
		uri  string
		want string
	}{
		// database name extracted from URI path segment
		{"alphanumeric name", "mongodb://localhost:27017/mydb", "mydb"},
		{"name with underscore and digits", "mongodb://localhost:27017/delta5_run123", "delta5_run123"},
		{"name with hyphen", "mongodb://localhost:27017/my-db", "my-db"},

		// URI variants that include a database path segment
		{"credentials and query options", "mongodb://user:pass@host:27017/mydb?authSource=admin", "mydb"},
		{"srv scheme", "mongodb+srv://cluster.example.net/proddb", "proddb"},
		{"replica set with multiple hosts", "mongodb://a:27017,b:27017/rsdb?replicaSet=rs0", "rsdb"},

		// no database path segment → default
		{"host and port only", "mongodb://localhost:27017", defaultDatabase},
		{"trailing slash with no name segment", "mongodb://localhost:27017/", defaultDatabase},
		{"query string without path segment", "mongodb://localhost:27017?replicaSet=rs0", defaultDatabase},

		// malformed input → default
		{"unparseable scheme", "://bad", defaultDatabase},
		{"empty string", "", defaultDatabase},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := dbNameFromURI(tt.uri)
			if got != tt.want {
				t.Errorf("dbNameFromURI(%q) = %q, want %q", tt.uri, got, tt.want)
			}
		})
	}
}

func TestResolveMongoDatabase(t *testing.T) {
	tests := []struct {
		name  string
		envDB string
		uri   string
		want  string
	}{
		// explicit MONGO_DATABASE env takes precedence over any URI
		{"explicit env beats URI with path", "production", "mongodb://host/other-db", "production"},
		{"explicit env beats pathless URI", "staging", "mongodb://host:27017", "staging"},

		// env absent: database name derived from URI path segment
		{"empty env resolves from URI path", "", "mongodb://localhost:27017/delta5_12345", "delta5_12345"},

		// env absent and URI carries no path → hard default
		{"empty env and pathless URI yields default", "", "mongodb://localhost:27017", defaultDatabase},
		{"empty env and empty URI yields default", "", "", defaultDatabase},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveMongoDatabase(tt.envDB, tt.uri)
			if got != tt.want {
				t.Errorf("resolveMongoDatabase(%q, %q) = %q, want %q", tt.envDB, tt.uri, got, tt.want)
			}
		})
	}
}
