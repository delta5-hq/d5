package integration

import (
	"testing"

	"backend-v2/internal/common/encryption"
	"backend-v2/internal/config"
)

func TestRegisterReturnsServiceInitializationErrors(t *testing.T) {
	oldSecret := config.JwtSecret
	defer func() {
		config.JwtSecret = oldSecret
		encryption.ResetService()
	}()
	config.JwtSecret = "short"
	encryption.ResetService()

	defer func() {
		if recovered := recover(); recovered != nil {
			t.Fatalf("Register panicked on service initialization error: %v", recovered)
		}
	}()

	err := Register(nil, nil, nil)
	if err == nil {
		t.Fatal("Register error = nil, want service initialization error")
	}
}
