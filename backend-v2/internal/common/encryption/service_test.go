package encryption

import (
	"testing"
)

func TestService_EncryptDecrypt(t *testing.T) {
	kd, _ := NewKeyDerivation("test-secret-at-least-16-bytes")
	cipher := NewCipher()
	marker := NewMarker()
	service := NewService(kd, cipher, marker)

	tests := []struct {
		name      string
		plaintext string
	}{
		{
			name:      "encrypts and decrypts text",
			plaintext: "sensitive data",
		},
		{
			name:      "handles empty string",
			plaintext: "",
		},
		{
			name:      "handles unicode",
			plaintext: "Привет мир 🌍",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := service.Encrypt(tt.plaintext)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			if tt.plaintext != "" && !marker.IsMarked(encrypted) {
				t.Error("encrypted value should be marked")
			}

			decrypted, err := service.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("decrypted = %v, want %v", decrypted, tt.plaintext)
			}
		})
	}
}

func TestService_Encrypt_Idempotent(t *testing.T) {
	kd, _ := NewKeyDerivation("test-secret-at-least-16-bytes")
	cipher := NewCipher()
	marker := NewMarker()
	service := NewService(kd, cipher, marker)

	plaintext := "test data"

	encrypted1, _ := service.Encrypt(plaintext)
	encrypted2, _ := service.Encrypt(encrypted1) // Encrypt already-encrypted

	if encrypted1 != encrypted2 {
		t.Error("encrypting already-encrypted value should be idempotent")
	}
}

func TestService_Decrypt_HandlesPlaintext(t *testing.T) {
	kd, _ := NewKeyDerivation("test-secret-at-least-16-bytes")
	cipher := NewCipher()
	marker := NewMarker()
	service := NewService(kd, cipher, marker)

	plaintext := "not encrypted"

	decrypted, err := service.Decrypt(plaintext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("decrypting plaintext should return as-is, got %v", decrypted)
	}
}

func TestService_MixedState(t *testing.T) {
	kd, _ := NewKeyDerivation("test-secret-at-least-16-bytes")
	cipher := NewCipher()
	marker := NewMarker()
	service := NewService(kd, cipher, marker)

	// Simulate mixed state: some values encrypted, some plaintext
	plainValue := "plaintext-value"
	secretValue := "secret-value"

	encrypted, _ := service.Encrypt(secretValue)

	// Decrypt both
	decrypted1, err := service.Decrypt(plainValue)
	if err != nil {
		t.Fatalf("Decrypt plaintext failed: %v", err)
	}
	if decrypted1 != plainValue {
		t.Errorf("plaintext decryption = %v, want %v", decrypted1, plainValue)
	}

	decrypted2, err := service.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt encrypted failed: %v", err)
	}
	if decrypted2 != secretValue {
		t.Errorf("encrypted decryption = %v, want %v", decrypted2, secretValue)
	}
}
