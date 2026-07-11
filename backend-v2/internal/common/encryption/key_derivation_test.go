package encryption

import (
	"bytes"
	"testing"
)

func TestNewKeyDerivation_Validation(t *testing.T) {
	tests := []struct {
		name      string
		secret    string
		wantError bool
	}{
		{
			name:      "accepts valid secret",
			secret:    "test-secret-at-least-16-bytes",
			wantError: false,
		},
		{
			name:      "rejects empty secret",
			secret:    "",
			wantError: true,
		},
		{
			name:      "rejects short secret",
			secret:    "short",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kd, err := NewKeyDerivation(tt.secret)
			if tt.wantError {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if kd == nil {
				t.Error("expected key derivation instance, got nil")
			}
		})
	}
}

func TestKeyDerivation_GetKey(t *testing.T) {
	secret := "test-secret-at-least-16-bytes"
	kd, err := NewKeyDerivation(secret)
	if err != nil {
		t.Fatalf("NewKeyDerivation failed: %v", err)
	}

	key := kd.GetKey()

	if len(key) != keyLength {
		t.Errorf("key length = %d, want %d", len(key), keyLength)
	}
}

func TestKeyDerivation_Deterministic(t *testing.T) {
	secret := "test-secret-at-least-16-bytes"

	kd1, _ := NewKeyDerivation(secret)
	kd2, _ := NewKeyDerivation(secret)

	key1 := kd1.GetKey()
	key2 := kd2.GetKey()

	if !bytes.Equal(key1, key2) {
		t.Error("same secret should produce same key")
	}
}

func TestKeyDerivation_DifferentSecrets(t *testing.T) {
	kd1, _ := NewKeyDerivation("secret-one-at-least-16-bytes")
	kd2, _ := NewKeyDerivation("secret-two-at-least-16-bytes")

	key1 := kd1.GetKey()
	key2 := kd2.GetKey()

	if bytes.Equal(key1, key2) {
		t.Error("different secrets should produce different keys")
	}
}
