package integration_test

import (
	"backend-v2/internal/models"
	"backend-v2/internal/modules/integration"
	"testing"
)

func TestArrayFieldRegistry(t *testing.T) {
	t.Run("RegisteredFieldsAreRecognized", func(t *testing.T) {
		for _, field := range []string{"mcp", "rpc"} {
			if !integration.IsArrayFieldRegistered(field) {
				t.Errorf("Expected field %s to be registered", field)
			}
		}
	})

	t.Run("UnregisteredFieldsAreRejected", func(t *testing.T) {
		for _, field := range []string{"unknown", "invalid", "openai", "claude", "", "MCP"} {
			if integration.IsArrayFieldRegistered(field) {
				t.Errorf("Field %q should not be registered", field)
			}
		}
	})
}

func TestSecretRedactor_SentinelEmptyStringHandling(t *testing.T) {
	redactor := integration.NewSecretRedactor()

	tests := []struct {
		name       string
		privateKey string
		passphrase string
		wantPK     string
		wantPP     string
	}{
		{
			name:       "non-empty credentials become sentinel",
			privateKey: "ssh-rsa AAAA...",
			passphrase: "secret123",
			wantPK:     integration.SecretRedactionSentinel,
			wantPP:     integration.SecretRedactionSentinel,
		},
		{
			name:       "empty credentials remain empty",
			privateKey: "",
			passphrase: "",
			wantPK:     "",
			wantPP:     "",
		},
		{
			name:       "mixed empty and non-empty",
			privateKey: "key",
			passphrase: "",
			wantPK:     integration.SecretRedactionSentinel,
			wantPP:     "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			integ := &models.Integration{
				RPC: []models.RPCIntegrationConfig{
					{
						Alias:      "/test",
						PrivateKey: tt.privateKey,
						Passphrase: tt.passphrase,
						Host:       "example.com",
					},
				},
			}

			redactor.RedactSecretsFromIntegration(integ)

			if integ.RPC[0].PrivateKey != tt.wantPK {
				t.Errorf("PrivateKey = %q, want %q", integ.RPC[0].PrivateKey, tt.wantPK)
			}
			if integ.RPC[0].Passphrase != tt.wantPP {
				t.Errorf("Passphrase = %q, want %q", integ.RPC[0].Passphrase, tt.wantPP)
			}
			if integ.RPC[0].Host != "example.com" {
				t.Error("Non-secret fields should be preserved")
			}
		})
	}
}
