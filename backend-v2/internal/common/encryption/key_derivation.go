package encryption

import (
	"crypto/sha256"
	"errors"
	"fmt"

	"golang.org/x/crypto/pbkdf2"
)

const (
	saltSuffix  = "field-encryption-salt"
	iterations  = 10000
	keyLength   = 32
	minKeyBytes = 16
)

// KeyDerivation derives deterministic encryption keys from secrets.
// Uses PBKDF2 with SHA-256 for key stretching.
type KeyDerivation struct {
	derivedKey []byte
}

// NewKeyDerivation creates a key derivation instance.
// Returns error if secret is invalid.
func NewKeyDerivation(secret string) (*KeyDerivation, error) {
	if err := validateSecret(secret); err != nil {
		return nil, err
	}

	key := deriveKey(secret)
	return &KeyDerivation{derivedKey: key}, nil
}

// GetKey returns the derived encryption key.
func (kd *KeyDerivation) GetKey() []byte {
	return kd.derivedKey
}

func validateSecret(secret string) error {
	if secret == "" {
		return errors.New("encryption secret is required")
	}
	if len(secret) < minKeyBytes {
		return fmt.Errorf("encryption secret must be at least %d bytes", minKeyBytes)
	}
	return nil
}

func deriveKey(secret string) []byte {
	salt := sha256.Sum256([]byte(secret + saltSuffix))
	return pbkdf2.Key([]byte(secret), salt[:], iterations, keyLength, sha256.New)
}
