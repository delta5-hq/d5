package integration

import (
	"strings"
	"testing"
)

// TestFieldCrypto_SelectiveEncryption verifies only configured fields are encrypted.
func TestFieldCrypto_SelectiveEncryption(t *testing.T) {
	crypto, err := NewFieldCrypto()
	if err != nil {
		t.Fatalf("NewFieldCrypto failed: %v", err)
	}

	tests := []struct {
		name          string
		arrayName     string
		fieldName     string
		value         interface{}
		shouldEncrypt bool
	}{
		// RPC secret fields
		{name: "RPC privateKey", arrayName: "rpc", fieldName: "privateKey", value: "-----BEGIN RSA PRIVATE KEY-----\ntest", shouldEncrypt: true},
		{name: "RPC passphrase", arrayName: "rpc", fieldName: "passphrase", value: "secret123", shouldEncrypt: true},
		{name: "RPC headers (serialized)", arrayName: "rpc", fieldName: "headers", value: map[string]string{"Authorization": "Bearer token"}, shouldEncrypt: true},
		{name: "RPC env (serialized)", arrayName: "rpc", fieldName: "env", value: map[string]string{"API_KEY": "secret"}, shouldEncrypt: true},

		// MCP secret fields
		{name: "MCP headers (serialized)", arrayName: "mcp", fieldName: "headers", value: map[string]string{"X-API-Key": "secret"}, shouldEncrypt: true},
		{name: "MCP env (serialized)", arrayName: "mcp", fieldName: "env", value: map[string]string{"SECRET": "value"}, shouldEncrypt: true},

		// RPC non-secret fields
		{name: "RPC alias", arrayName: "rpc", fieldName: "alias", value: "/ssh1", shouldEncrypt: false},
		{name: "RPC host", arrayName: "rpc", fieldName: "host", value: "example.com", shouldEncrypt: false},
		{name: "RPC port", arrayName: "rpc", fieldName: "port", value: 22, shouldEncrypt: false},
		{name: "RPC protocol", arrayName: "rpc", fieldName: "protocol", value: "ssh", shouldEncrypt: false},

		// MCP non-secret fields
		{name: "MCP alias", arrayName: "mcp", fieldName: "alias", value: "/mcp1", shouldEncrypt: false},
		{name: "MCP toolName", arrayName: "mcp", fieldName: "toolName", value: "test-tool", shouldEncrypt: false},
		{name: "MCP transport", arrayName: "mcp", fieldName: "transport", value: "stdio", shouldEncrypt: false},
	}

	testScope := ScopeIdentifier{
		UserID:     "test-user-123",
		WorkflowID: nil,
	}
	testAlias := "/test-alias"

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := crypto.EncryptArrayFieldUpdate(testScope, tt.arrayName, testAlias, tt.fieldName, tt.value)
			if err != nil {
				t.Fatalf("EncryptArrayFieldUpdate failed: %v", err)
			}

			if tt.shouldEncrypt {
				encStr, ok := encrypted.(string)
				if !ok {
					t.Errorf("Expected encrypted string, got %T", encrypted)
					return
				}

				if !strings.HasPrefix(encStr, "__encrypted__") {
					t.Errorf("Encrypted value missing marker prefix")
				}

				if encStr == tt.value {
					t.Errorf("Value was not encrypted")
				}
			} else {
				if encrypted != tt.value {
					t.Errorf("Non-secret field was modified: got %v, want %v", encrypted, tt.value)
				}
			}
		})
	}
}
