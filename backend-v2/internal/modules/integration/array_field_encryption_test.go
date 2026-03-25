package integration

import "testing"

func TestIsEncryptedField(t *testing.T) {
	tests := []struct {
		name      string
		arrayName string
		fieldName string
		want      bool
	}{
		{
			name:      "RPC privateKey is encrypted",
			arrayName: "rpc",
			fieldName: "privateKey",
			want:      true,
		},
		{
			name:      "RPC passphrase is encrypted",
			arrayName: "rpc",
			fieldName: "passphrase",
			want:      true,
		},
		{
			name:      "RPC headers is encrypted",
			arrayName: "rpc",
			fieldName: "headers",
			want:      true,
		},
		{
			name:      "RPC env is encrypted",
			arrayName: "rpc",
			fieldName: "env",
			want:      true,
		},
		{
			name:      "RPC alias is not encrypted",
			arrayName: "rpc",
			fieldName: "alias",
			want:      false,
		},
		{
			name:      "RPC host is not encrypted",
			arrayName: "rpc",
			fieldName: "host",
			want:      false,
		},
		{
			name:      "RPC protocol is not encrypted",
			arrayName: "rpc",
			fieldName: "protocol",
			want:      false,
		},
		{
			name:      "MCP headers is encrypted",
			arrayName: "mcp",
			fieldName: "headers",
			want:      true,
		},
		{
			name:      "MCP env is encrypted",
			arrayName: "mcp",
			fieldName: "env",
			want:      true,
		},
		{
			name:      "MCP alias is not encrypted",
			arrayName: "mcp",
			fieldName: "alias",
			want:      false,
		},
		{
			name:      "MCP toolName is not encrypted",
			arrayName: "mcp",
			fieldName: "toolName",
			want:      false,
		},
		{
			name:      "nonexistent array returns false",
			arrayName: "unknown",
			fieldName: "anyfield",
			want:      false,
		},
		{
			name:      "nonexistent field in valid array returns false",
			arrayName: "rpc",
			fieldName: "nonexistent",
			want:      false,
		},
		{
			name:      "empty array name returns false",
			arrayName: "",
			fieldName: "privateKey",
			want:      false,
		},
		{
			name:      "empty field name returns false",
			arrayName: "rpc",
			fieldName: "",
			want:      false,
		},
		{
			name:      "both empty returns false",
			arrayName: "",
			fieldName: "",
			want:      false,
		},
		{
			name:      "case sensitive array name",
			arrayName: "RPC",
			fieldName: "privateKey",
			want:      false,
		},
		{
			name:      "case sensitive field name",
			arrayName: "rpc",
			fieldName: "PrivateKey",
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isEncryptedField(tt.arrayName, tt.fieldName)
			if got != tt.want {
				t.Errorf("isEncryptedField(%q, %q) = %v, want %v", tt.arrayName, tt.fieldName, got, tt.want)
			}
		})
	}
}

func TestValidateNoSentinelSecrets(t *testing.T) {
	tests := []struct {
		name      string
		arrayName string
		item      map[string]interface{}
		wantErr   bool
	}{
		{
			name:      "valid item with real secrets",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":      "/test",
				"privateKey": "ssh-rsa AAAA...",
				"passphrase": "secret123",
			},
			wantErr: false,
		},
		{
			name:      "valid item with empty secrets",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":      "/test",
				"privateKey": "",
				"passphrase": "",
			},
			wantErr: false,
		},
		{
			name:      "valid item with no secret fields",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":    "/test",
				"host":     "example.com",
				"protocol": "ssh",
			},
			wantErr: false,
		},
		{
			name:      "reject sentinel in privateKey",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":      "/test",
				"privateKey": SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "reject sentinel in passphrase",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":      "/test",
				"passphrase": SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "reject sentinel in headers",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":   "/test",
				"headers": SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "reject sentinel in env",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias": "/test",
				"env":   SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "reject sentinel in MCP headers",
			arrayName: "mcp",
			item: map[string]interface{}{
				"alias":   "/test",
				"headers": SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "reject sentinel in MCP env",
			arrayName: "mcp",
			item: map[string]interface{}{
				"alias": "/test",
				"env":   SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "allow sentinel in non-encrypted field",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias": SecretRedactionSentinel,
			},
			wantErr: false,
		},
		{
			name:      "valid for unknown array",
			arrayName: "unknown",
			item: map[string]interface{}{
				"anyfield": SecretRedactionSentinel,
			},
			wantErr: false,
		},
		{
			name:      "mixed valid and sentinel secrets",
			arrayName: "rpc",
			item: map[string]interface{}{
				"alias":      "/test",
				"privateKey": "real-key",
				"passphrase": SecretRedactionSentinel,
			},
			wantErr: true,
		},
		{
			name:      "empty item",
			arrayName: "rpc",
			item:      map[string]interface{}{},
			wantErr:   false,
		},
		{
			name:      "nil item",
			arrayName: "rpc",
			item:      nil,
			wantErr:   false,
		},
		{
			name:      "empty array name",
			arrayName: "",
			item: map[string]interface{}{
				"privateKey": SecretRedactionSentinel,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateNoSentinelSecrets(tt.arrayName, tt.item)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateNoSentinelSecrets(%q, %v) error = %v, wantErr %v", tt.arrayName, tt.item, err, tt.wantErr)
			}
		})
	}
}
