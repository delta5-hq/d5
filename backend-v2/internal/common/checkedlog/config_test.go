package checkedlog

import "testing"

func TestConfigFromEnvValidation(t *testing.T) {
	tests := []struct {
		name    string
		checker string
		values  string
		timeout string
		wantErr bool
	}{
		{name: "missing checker", values: "/run/values.json", timeout: "2000", wantErr: true},
		{name: "missing registered values file", checker: "/bin/checker", timeout: "2000", wantErr: true},
		{name: "invalid timeout", checker: "/bin/checker", values: "/run/values.json", timeout: "0", wantErr: true},
		{name: "valid explicit timeout", checker: "/bin/checker", values: "/run/values.json", timeout: "1500"},
		{name: "valid default timeout", checker: "/bin/checker", values: "/run/values.json"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv(EnvCheckerPath, tt.checker)
			t.Setenv(EnvRegisteredValuesPath, tt.values)
			t.Setenv(EnvTimeoutMilliseconds, tt.timeout)

			_, err := ConfigFromEnv()

			if tt.wantErr && err == nil {
				t.Fatal("expected config validation error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("ConfigFromEnv error = %v", err)
			}
		})
	}
}
