package encryption

type DecryptStrategy interface {
	Decrypt(ciphertext string, key []byte, additionalData []byte) (string, error)
}

type StandardDecrypt struct {
	cipher *Cipher
}

func NewStandardDecrypt(cipher *Cipher) *StandardDecrypt {
	return &StandardDecrypt{cipher: cipher}
}

func (s *StandardDecrypt) Decrypt(ciphertext string, key []byte, additionalData []byte) (string, error) {
	return s.cipher.Decrypt(ciphertext, key, additionalData)
}

type FallbackDecrypt struct {
	cipher *Cipher
}

func NewFallbackDecrypt(cipher *Cipher) *FallbackDecrypt {
	return &FallbackDecrypt{cipher: cipher}
}

func (f *FallbackDecrypt) Decrypt(ciphertext string, key []byte, additionalData []byte) (string, error) {
	plaintext, err := f.cipher.Decrypt(ciphertext, key, additionalData)
	if err != nil && additionalData != nil {
		return f.cipher.Decrypt(ciphertext, key, nil)
	}
	return plaintext, err
}
