package encryption

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

const (
	// Matches Node.js fieldEncryption.js IV_LENGTH and AUTH_TAG_LENGTH
	ivLength      = 16
	authTagLength = 16
)

// Cipher performs AES-256-GCM encryption and decryption.
// Wire format matches Node.js: IV(16) || AuthTag(16) || Ciphertext
type Cipher struct{}

func NewCipher() *Cipher {
	return &Cipher{}
}

func (c *Cipher) Encrypt(plaintext string, key []byte, additionalData []byte) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCMWithNonceSize(block, ivLength)
	if err != nil {
		return "", err
	}

	iv := make([]byte, ivLength)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}

	// GCM Seal produces: ciphertext || authTag (tag appended at end)
	sealed := gcm.Seal(nil, iv, []byte(plaintext), additionalData)

	// Reorder to match Node.js: IV || AuthTag || Ciphertext
	ciphertextBody := sealed[:len(sealed)-authTagLength]
	authTag := sealed[len(sealed)-authTagLength:]

	result := make([]byte, 0, ivLength+authTagLength+len(ciphertextBody))
	result = append(result, iv...)
	result = append(result, authTag...)
	result = append(result, ciphertextBody...)

	return base64.StdEncoding.EncodeToString(result), nil
}

func (c *Cipher) Decrypt(encoded string, key []byte, additionalData []byte) (string, error) {
	if encoded == "" {
		return "", nil
	}

	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}

	if len(data) < ivLength+authTagLength {
		return "", errors.New("ciphertext too short")
	}

	iv := data[:ivLength]
	authTag := data[ivLength : ivLength+authTagLength]
	ciphertextBody := data[ivLength+authTagLength:]

	// Reorder back to what GCM Open expects: ciphertext || authTag
	sealed := append(ciphertextBody, authTag...)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCMWithNonceSize(block, ivLength)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, sealed, additionalData)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
