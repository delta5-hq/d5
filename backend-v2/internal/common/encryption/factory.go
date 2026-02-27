package encryption

import "backend-v2/internal/config"

var serviceInstance *Service

// GetService returns singleton encryption service instance.
// Uses JWT_SECRET from config for key derivation.
func GetService() (*Service, error) {
	if serviceInstance != nil {
		return serviceInstance, nil
	}

	keyDerivation, err := NewKeyDerivation(config.JwtSecret)
	if err != nil {
		return nil, err
	}

	cipher := NewCipher()
	marker := NewMarker()
	serviceInstance = NewService(keyDerivation, cipher, marker)

	return serviceInstance, nil
}

// ResetService clears singleton instance (for testing).
func ResetService() {
	serviceInstance = nil
}
