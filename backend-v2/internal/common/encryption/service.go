package encryption

type Service struct {
	key             []byte
	cipher          *Cipher
	marker          *Marker
	decryptStrategy DecryptStrategy
}

func NewService(keyDerivation *KeyDerivation, cipher *Cipher, marker *Marker) *Service {
	return &Service{
		key:             keyDerivation.GetKey(),
		cipher:          cipher,
		marker:          marker,
		decryptStrategy: NewFallbackDecrypt(cipher),
	}
}

func (s *Service) Encrypt(plaintext string, additionalData []byte) (string, error) {
	if plaintext == "" {
		return "", nil
	}

	if s.marker.IsMarked(plaintext) {
		return plaintext, nil
	}

	ciphertext, err := s.cipher.Encrypt(plaintext, s.key, additionalData)
	if err != nil {
		return "", err
	}

	return s.marker.Mark(ciphertext), nil
}

func (s *Service) Decrypt(markedCiphertext string, additionalData []byte) (string, error) {
	if markedCiphertext == "" {
		return "", nil
	}

	if !s.marker.IsMarked(markedCiphertext) {
		return markedCiphertext, nil
	}

	ciphertext := s.marker.Unmark(markedCiphertext)
	return s.decryptStrategy.Decrypt(ciphertext, s.key, additionalData)
}
