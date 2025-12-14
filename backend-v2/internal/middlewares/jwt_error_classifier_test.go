package middlewares_test

import (
	"backend-v2/internal/middlewares"
	"testing"
)

func TestJWTErrorClassifier_IsAuthenticationRequired(t *testing.T) {
	tests := []struct {
		name          string
		errorMessage  string
		expectBlocked bool
	}{
		{
			name:          "no error - allow",
			errorMessage:  middlewares.JWTErrorNone,
			expectBlocked: false,
		},
		{
			name:          "missing token - allow (optional auth)",
			errorMessage:  middlewares.JWTErrorMissingToken,
			expectBlocked: false,
		},
		{
			name:          "invalid signature - block",
			errorMessage:  middlewares.JWTErrorInvalidSignature,
			expectBlocked: true,
		},
		{
			name:          "token expired - block",
			errorMessage:  "token is expired",
			expectBlocked: true,
		},
		{
			name:          "token malformed - block",
			errorMessage:  "token is malformed",
			expectBlocked: true,
		},
		{
			name:          "unexpected signing method - block",
			errorMessage:  "unexpected signing method",
			expectBlocked: true,
		},
		{
			name:          "invalid token format - block",
			errorMessage:  "invalid token format in cookie",
			expectBlocked: true,
		},
		{
			name:          "url encoded tokens not allowed - block",
			errorMessage:  "url encoded tokens not allowed",
			expectBlocked: true,
		},
	}

	classifier := middlewares.NewJWTErrorClassifier()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := classifier.IsAuthenticationRequired(tt.errorMessage)

			if result != tt.expectBlocked {
				t.Errorf("IsAuthenticationRequired(%q) = %v, want %v",
					tt.errorMessage, result, tt.expectBlocked)
			}
		})
	}
}

func TestJWTErrorClassifier_HasNoToken(t *testing.T) {
	tests := []struct {
		name          string
		errorMessage  string
		expectNoToken bool
	}{
		{
			name:          "missing token error",
			errorMessage:  middlewares.JWTErrorMissingToken,
			expectNoToken: true,
		},
		{
			name:          "no error",
			errorMessage:  middlewares.JWTErrorNone,
			expectNoToken: false,
		},
		{
			name:          "invalid signature",
			errorMessage:  middlewares.JWTErrorInvalidSignature,
			expectNoToken: false,
		},
		{
			name:          "other error",
			errorMessage:  "token is expired",
			expectNoToken: false,
		},
	}

	classifier := middlewares.NewJWTErrorClassifier()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := classifier.HasNoToken(tt.errorMessage)

			if result != tt.expectNoToken {
				t.Errorf("HasNoToken(%q) = %v, want %v",
					tt.errorMessage, result, tt.expectNoToken)
			}
		})
	}
}

func TestJWTErrorClassifier_ErrorClassificationConsistency(t *testing.T) {
	classifier := middlewares.NewJWTErrorClassifier()

	errorMessage := middlewares.JWTErrorMissingToken

	isRequired := classifier.IsAuthenticationRequired(errorMessage)
	hasNoToken := classifier.HasNoToken(errorMessage)

	if isRequired && hasNoToken {
		t.Error("Error should not be both 'authentication required' and 'has no token'")
	}

	if !isRequired && !hasNoToken {
		t.Error("JWTErrorMissingToken should trigger HasNoToken or IsAuthenticationRequired")
	}
}

func TestJWTErrorClassifier_EdgeCases(t *testing.T) {
	tests := []struct {
		name           string
		errorMessage   string
		expectRequired bool
		expectNoToken  bool
	}{
		{
			name:           "empty string",
			errorMessage:   "",
			expectRequired: false,
			expectNoToken:  false,
		},
		{
			name:           "whitespace only",
			errorMessage:   "   ",
			expectRequired: true,
			expectNoToken:  false,
		},
		{
			name: "very long error message",
			errorMessage: "this is a very long error message that describes " +
				"in great detail what went wrong with the JWT token validation process",
			expectRequired: true,
			expectNoToken:  false,
		},
		{
			name:           "error with special characters",
			errorMessage:   "token\ninvalid\t\r\n",
			expectRequired: true,
			expectNoToken:  false,
		},
	}

	classifier := middlewares.NewJWTErrorClassifier()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isRequired := classifier.IsAuthenticationRequired(tt.errorMessage)
			hasNoToken := classifier.HasNoToken(tt.errorMessage)

			if isRequired != tt.expectRequired {
				t.Errorf("IsAuthenticationRequired(%q) = %v, want %v",
					tt.errorMessage, isRequired, tt.expectRequired)
			}

			if hasNoToken != tt.expectNoToken {
				t.Errorf("HasNoToken(%q) = %v, want %v",
					tt.errorMessage, hasNoToken, tt.expectNoToken)
			}
		})
	}
}

func BenchmarkJWTErrorClassifier_IsAuthenticationRequired(b *testing.B) {
	classifier := middlewares.NewJWTErrorClassifier()
	errorMessage := "signature is invalid"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		classifier.IsAuthenticationRequired(errorMessage)
	}
}

func BenchmarkJWTErrorClassifier_HasNoToken(b *testing.B) {
	classifier := middlewares.NewJWTErrorClassifier()
	errorMessage := middlewares.JWTErrorMissingToken

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		classifier.HasNoToken(errorMessage)
	}
}
