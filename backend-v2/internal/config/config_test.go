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

// "dev" is the sentinel for "no SHA injected at build time", not merely a non-empty placeholder.
func TestBuildVersion_SentinelExactValue(t *testing.T) {
	if BuildVersion != "dev" {
		t.Errorf("BuildVersion without ldflags injection = %q; want sentinel %q", BuildVersion, "dev")
	}
}

// Env fills missing versions at runtime but cannot overwrite a SHA baked in by ldflags.
func TestOverrideVersionFromEnv(t *testing.T) {
	cases := []struct {
		name    string
		current string
		envVal  string
		want    string
	}{
		{"sentinel + non-empty env: env wins", "dev", "abc123", "abc123"},
		{"sentinel + empty env: sentinel kept", "dev", "", "dev"},
		{"non-sentinel + non-empty env: current kept", "baked-sha", "abc123", "baked-sha"},
		{"non-sentinel + empty env: current kept", "baked-sha", "", "baked-sha"},
		{"sentinel + composite sha+tree format: composite wins", "dev", "deadbeef+cafebabe", "deadbeef+cafebabe"},
		{"sentinel + composite sha+tree[dirty] format: dirty composite wins", "dev", "deadbeef+cafebabe[dirty]", "deadbeef+cafebabe[dirty]"},
		{"non-sentinel + composite sha+tree[dirty] format: current kept", "baked-sha", "deadbeef+cafebabe[dirty]", "baked-sha"},
		{"non-sentinel matching env: current returned unchanged", "abc123", "abc123", "abc123"},
		{"sentinel + env also sentinel: env wins (idempotent, both are dev)", "dev", "dev", "dev"},
		// Content validation is the caller's responsibility; non-empty whitespace is a valid override.
		{"sentinel + whitespace-only env: whitespace overrides sentinel (non-empty beats dev)", "dev", "  ", "  "},
		{"sentinel + tab-only env: tab overrides sentinel", "dev", "\t", "\t"},
		{"non-sentinel + whitespace-only env: current kept (env gate requires sentinel)", "baked-sha", "  ", "baked-sha"},
		// Empty-string current is not the dev sentinel — env cannot override it either.
		{"empty-string current + non-empty env: current kept (empty string is not the dev sentinel)", "", "abc123", ""},
		{"empty-string current + empty env: current kept", "", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := overrideVersionFromEnv(tc.current, tc.envVal)
			if got != tc.want {
				t.Errorf("overrideVersionFromEnv(%q, %q) = %q; want %q",
					tc.current, tc.envVal, got, tc.want)
			}
		})
	}
}
