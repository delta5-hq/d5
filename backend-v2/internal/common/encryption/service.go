package encryption

// Service provides high-level encryption/decryption with idempotent marking.
type Service struct {
	key    []byte
	cipher *Cipher
	marker *Marker
}

// NewService creates an encryption service instance.
func NewService(keyDerivation *KeyDerivation, cipher *Cipher, marker *Marker) *Service {
	return &Service{
		key:    keyDerivation.GetKey(),
		cipher: cipher,
		marker: marker,
	}
}

// Encrypt encrypts plaintext and marks result.
// If already marked, returns as-is (idempotent).
func (s *Service) Encrypt(plaintext string) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	if s.marker.IsMarked(plaintext) {
		return plaintext, nil
	}

	ciphertext, err := s.cipher.Encrypt(plaintext, s.key)
	if err != nil {
		return "", err
	}

	return s.marker.Mark(ciphertext), nil
}

// Decrypt decrypts marked ciphertext.
// If not marked, returns as-is (handles mixed encrypted/plaintext state).
func (s *Service) Decrypt(markedCiphertext string) (string, error) {
	if markedCiphertext == "" {
		return "", nil
	}

	if !s.marker.IsMarked(markedCiphertext) {
		return markedCiphertext, nil
	}

	ciphertext := s.marker.Unmark(markedCiphertext)
	return s.cipher.Decrypt(ciphertext, s.key)
}
