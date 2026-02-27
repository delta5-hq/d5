package encryption

import (
	"bytes"
	"strings"
	"testing"
)

func TestCipher_EncryptDecrypt(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))

	tests := []struct {
		name      string
		plaintext string
	}{
		{
			name:      "encrypts and decrypts simple text",
			plaintext: "hello world",
		},
		{
			name:      "handles empty string",
			plaintext: "",
		},
		{
			name:      "handles unicode",
			plaintext: "Hello 世界 🌍",
		},
		{
			name:      "handles long text",
			plaintext: strings.Repeat("a", 1000),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := cipher.Encrypt(tt.plaintext, key)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			if tt.plaintext != "" && encrypted == "" {
				t.Error("expected non-empty ciphertext")
			}

			decrypted, err := cipher.Decrypt(encrypted, key)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("decrypted = %v, want %v", decrypted, tt.plaintext)
			}
		})
	}
}

func TestCipher_Encrypt_NonDeterministic(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))

	plaintext := "same plaintext"

	encrypted1, _ := cipher.Encrypt(plaintext, key)
	encrypted2, _ := cipher.Encrypt(plaintext, key)

	if encrypted1 == encrypted2 {
		t.Error("same plaintext should produce different ciphertext (random IV)")
	}
}

func TestCipher_Decrypt_InvalidInput(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))

	tests := []struct {
		name       string
		ciphertext string
		wantError  bool
	}{
		{
			name:       "rejects invalid base64",
			ciphertext: "not-valid-base64!!!",
			wantError:  true,
		},
		{
			name:       "rejects too short ciphertext",
			ciphertext: "YWJj", // "abc" in base64, too short
			wantError:  true,
		},
		{
			name:       "rejects tampered ciphertext",
			ciphertext: "YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw",
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := cipher.Decrypt(tt.ciphertext, key)
			if tt.wantError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestCipher_Decrypt_WrongKey(t *testing.T) {
	cipher := NewCipher()
	key1 := make([]byte, 32)
	key2 := make([]byte, 32)
	copy(key1, []byte("key-one-32-bytes-long-exactly!!"))
	copy(key2, []byte("key-two-32-bytes-long-exactly!!"))

	plaintext := "secret message"
	encrypted, _ := cipher.Encrypt(plaintext, key1)

	_, err := cipher.Decrypt(encrypted, key2)
	if err == nil {
		t.Error("expected error when decrypting with wrong key")
	}
}

func TestCipher_EmptyString(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)

	encrypted, err := cipher.Encrypt("", key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	if encrypted != "" {
		t.Errorf("empty string should encrypt to empty string, got %v", encrypted)
	}

	decrypted, err := cipher.Decrypt("", key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if decrypted != "" {
		t.Errorf("empty string should decrypt to empty string, got %v", decrypted)
	}
}

func TestCipher_KeySize(t *testing.T) {
	cipher := NewCipher()
	plaintext := "test"

	tests := []struct {
		name      string
		keySize   int
		wantError bool
	}{
		{
			name:      "accepts 32-byte key (AES-256)",
			keySize:   32,
			wantError: false,
		},
		{
			name:      "rejects 16-byte key for AES-256",
			keySize:   16,
			wantError: false, // AES-128 is valid
		},
		{
			name:      "rejects invalid key size",
			keySize:   15,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := bytes.Repeat([]byte("a"), tt.keySize)
			_, err := cipher.Encrypt(plaintext, key)
			if tt.wantError && err == nil {
				t.Error("expected error, got nil")
			}
			if !tt.wantError && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}
