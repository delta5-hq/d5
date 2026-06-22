package config

import "testing"

func TestDatabaseFromURI(t *testing.T) {
	cases := []struct {
		rawURI string
		want   string
	}{
		{"mongodb://localhost:27017/delta5-dev", "delta5-dev"},
		{"mongodb://localhost:27017/delta5", "delta5"},
		{"mongodb://user:pass@host:27017/mydb", "mydb"},
		{"mongodb://localhost:27017/", ""},
		{"mongodb://localhost:27017", ""},
		{"mongodb://localhost:27017/delta5?authSource=admin", "delta5"},
		{"mongodb+srv://user:pass@cluster.example.com/myapp", "myapp"},
		{"mongodb://localhost:27017/  spaced  ", "spaced"},
		{"", ""},
		{"not-a-url\x00bad", ""},
	}

	for _, tc := range cases {
		got := databaseFromURI(tc.rawURI)
		if got != tc.want {
			t.Errorf("databaseFromURI(%q) = %q; want %q", tc.rawURI, got, tc.want)
		}
	}
}

func TestGetEnv_FallbackBehavior(t *testing.T) {
	cases := []struct {
		name     string
		key      string
		setEnv   bool
		envValue string
		fallback string
		want     string
	}{
		{"env set to non-empty: returns env value", "TEST_GETENV_SET", true, "from-env", "fallback", "from-env"},
		{"env absent: returns fallback", "TEST_GETENV_ABSENT", false, "", "my-default", "my-default"},
		{"env set to empty string: treated as absent, returns fallback", "TEST_GETENV_EXPLICIT_EMPTY", true, "", "sentinel", "sentinel"},
		{"env absent + empty fallback: returns empty string", "TEST_GETENV_ABSENT_EMPTY_FB", false, "", "", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.setEnv {
				t.Setenv(tc.key, tc.envValue)
			}
			got := getEnv(tc.key, tc.fallback)
			if got != tc.want {
				t.Errorf("getEnv(%q, %q) = %q; want %q", tc.key, tc.fallback, got, tc.want)
			}
		})
	}
}

// TestBuildRevision_SentinelExactValue: "dev" not merely non-empty —
// that signals "no revision injected at build time".
func TestBuildRevision_SentinelExactValue(t *testing.T) {
	if BuildRevision != "dev" {
		t.Errorf("BuildRevision without ldflags injection = %q; want sentinel %q", BuildRevision, "dev")
	}
}

// TestOverrideRevisionFromEnv: env fills missing revisions but cannot overwrite an ldflags-baked SHA.
func TestOverrideRevisionFromEnv(t *testing.T) {
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
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := overrideRevisionFromEnv(tc.current, tc.envVal)
			if got != tc.want {
				t.Errorf("overrideRevisionFromEnv(%q, %q) = %q; want %q",
					tc.current, tc.envVal, got, tc.want)
			}
		})
	}
}
