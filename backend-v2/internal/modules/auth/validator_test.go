package auth

import (
	"strings"
	"testing"
)

func TestSignupValidator_ValidateEmail(t *testing.T) {
	validator := NewSignupValidator()

	tests := []struct {
		name      string
		email     string
		expectErr bool
		errMsg    string
	}{
		{
			name:      "valid standard email",
			email:     "user@example.com",
			expectErr: false,
		},
		{
			name:      "valid email with subdomain",
			email:     "user@mail.example.com",
			expectErr: false,
		},
		{
			name:      "valid email with plus addressing",
			email:     "user+tag@example.com",
			expectErr: false,
		},
		{
			name:      "valid email with numbers",
			email:     "user123@example456.com",
			expectErr: false,
		},
		{
			name:      "valid email with hyphens",
			email:     "first-last@my-domain.com",
			expectErr: false,
		},
		{
			name:      "valid email with dots in local part",
			email:     "first.last@example.com",
			expectErr: false,
		},
		{
			name:      "empty email",
			email:     "",
			expectErr: true,
			errMsg:    "Email is required",
		},
		{
			name:      "email without @",
			email:     "invalidemail.com",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "email without domain",
			email:     "user@",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "email without local part",
			email:     "@example.com",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "email without TLD",
			email:     "user@domain",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "email with spaces",
			email:     "user @example.com",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "email with multiple @",
			email:     "user@@example.com",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
		{
			name:      "just @",
			email:     "@",
			expectErr: true,
			errMsg:    "Invalid email format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateEmail(tt.email)

			if tt.expectErr {
				if err == nil {
					t.Errorf("Expected error but got nil")
				} else if tt.errMsg != "" && !strings.Contains(err.Message, tt.errMsg) {
					t.Errorf("Expected error message to contain %q, got %q", tt.errMsg, err.Message)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestSignupValidator_ValidateUsername(t *testing.T) {
	validator := NewSignupValidator()

	tests := []struct {
		name      string
		username  string
		expectErr bool
		errMsg    string
	}{
		{
			name:      "valid alphanumeric username",
			username:  "validuser",
			expectErr: false,
		},
		{
			name:      "username with numbers",
			username:  "user123",
			expectErr: false,
		},
		{
			name:      "username with hyphens",
			username:  "user-name",
			expectErr: false,
		},
		{
			name:      "username with underscores",
			username:  "user_name",
			expectErr: false,
		},
		{
			name:      "username with dots",
			username:  "user.name",
			expectErr: false,
		},
		{
			name:      "single character username",
			username:  "a",
			expectErr: false,
		},
		{
			name:      "numeric only username",
			username:  "123456",
			expectErr: false,
		},
		{
			name:      "empty username",
			username:  "",
			expectErr: true,
			errMsg:    "Username is required",
		},
		{
			name:      "username with @ at start",
			username:  "@user",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
		{
			name:      "username with @ in middle",
			username:  "user@test",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
		{
			name:      "username with @ at end",
			username:  "user@",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
		{
			name:      "username looks like email",
			username:  "user@example.com",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
		{
			name:      "username with multiple @",
			username:  "user@@test",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
		{
			name:      "just @",
			username:  "@",
			expectErr: true,
			errMsg:    "must not contain @ symbol",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateUsername(tt.username)

			if tt.expectErr {
				if err == nil {
					t.Errorf("Expected error but got nil")
				} else if tt.errMsg != "" && !strings.Contains(err.Message, tt.errMsg) {
					t.Errorf("Expected error message to contain %q, got %q", tt.errMsg, err.Message)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestSignupValidator_ValidatePassword(t *testing.T) {
	validator := NewSignupValidator()

	tests := []struct {
		name      string
		password  string
		expectErr bool
		errMsg    string
	}{
		{
			name:      "valid strong password",
			password:  "ValidPass123!",
			expectErr: false,
		},
		{
			name:      "minimum length password",
			password:  "Pass123",
			expectErr: false,
		},
		{
			name:      "long password",
			password:  "ThisIsAVeryLongPasswordWith123Numbers!",
			expectErr: false,
		},
		{
			name:      "password with special characters",
			password:  "P@ssw0rd!#$",
			expectErr: false,
		},
		{
			name:      "password with spaces",
			password:  "Pass 123 Word",
			expectErr: false,
		},
		{
			name:      "exactly 7 characters",
			password:  "1234567",
			expectErr: false,
		},
		{
			name:      "empty password",
			password:  "",
			expectErr: true,
			errMsg:    "Password is required",
		},
		{
			name:      "one character password",
			password:  "a",
			expectErr: true,
			errMsg:    "at least 7 characters",
		},
		{
			name:      "six characters password",
			password:  "short6",
			expectErr: true,
			errMsg:    "at least 7 characters",
		},
		{
			name:      "whitespace only password",
			password:  "      ",
			expectErr: true,
			errMsg:    "at least 7 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidatePassword(tt.password)

			if tt.expectErr {
				if err == nil {
					t.Errorf("Expected error but got nil")
				} else if tt.errMsg != "" && !strings.Contains(err.Message, tt.errMsg) {
					t.Errorf("Expected error message to contain %q, got %q", tt.errMsg, err.Message)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestSignupValidator_ValidateSignupRequest_IntegrationScenarios(t *testing.T) {
	validator := NewSignupValidator()

	tests := []struct {
		name      string
		username  string
		email     string
		password  string
		expectErr bool
		errField  string
	}{
		{
			name:      "all valid inputs",
			username:  "testuser",
			email:     "test@example.com",
			password:  "ValidPass123!",
			expectErr: false,
		},
		{
			name:      "username fails first in validation chain",
			username:  "user@invalid",
			email:     "test@example.com",
			password:  "ValidPass123!",
			expectErr: true,
			errField:  "username",
		},
		{
			name:      "email fails after username passes",
			username:  "validuser",
			email:     "invalid",
			password:  "ValidPass123!",
			expectErr: true,
			errField:  "email",
		},
		{
			name:      "password fails after username and email pass",
			username:  "validuser",
			email:     "test@example.com",
			password:  "short",
			expectErr: true,
			errField:  "password",
		},
		{
			name:      "all fields empty",
			username:  "",
			email:     "",
			password:  "",
			expectErr: true,
			errField:  "username",
		},
		{
			name:      "all fields invalid",
			username:  "user@fail",
			email:     "notanemail",
			password:  "12345",
			expectErr: true,
			errField:  "username",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateSignupRequest(tt.username, tt.email, tt.password)

			if tt.expectErr {
				if err == nil {
					t.Errorf("Expected error but got nil")
				} else if tt.errField != "" && err.Field != tt.errField {
					t.Errorf("Expected error field %q, got %q", tt.errField, err.Field)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error but got: %v", err)
				}
			}
		})
	}
}

func TestSignupValidator_ValidationError_ErrorMethod(t *testing.T) {
	err := &ValidationError{
		Field:   "testField",
		Message: "test error message",
	}

	if err.Error() != "test error message" {
		t.Errorf("ValidationError.Error() = %q, want %q", err.Error(), "test error message")
	}
}

func TestSignupValidator_ConcurrentValidation(t *testing.T) {
	validator := NewSignupValidator()
	done := make(chan bool)

	validate := func(id int) {
		defer func() { done <- true }()

		username := "user" + strings.Repeat("a", id)
		email := "user" + strings.Repeat("a", id) + "@example.com"
		password := "Pass123" + strings.Repeat("!", id)

		err := validator.ValidateSignupRequest(username, email, password)
		if err != nil {
			t.Errorf("Goroutine %d: unexpected error: %v", id, err)
		}
	}

	concurrentTests := 10
	for i := 0; i < concurrentTests; i++ {
		go validate(i)
	}

	for i := 0; i < concurrentTests; i++ {
		<-done
	}
}

func TestSignupValidator_EdgeCases(t *testing.T) {
	validator := NewSignupValidator()

	tests := []struct {
		name        string
		username    string
		email       string
		password    string
		expectErr   bool
		description string
	}{
		{
			name:        "unicode characters in username",
			username:    "user中文",
			email:       "test@example.com",
			password:    "ValidPass123!",
			expectErr:   false,
			description: "Unicode characters should be allowed in username",
		},
		{
			name:        "very long valid inputs",
			username:    strings.Repeat("a", 100),
			email:       strings.Repeat("a", 50) + "@example.com",
			password:    strings.Repeat("P", 100) + "123!",
			expectErr:   false,
			description: "Very long valid inputs should pass",
		},
		{
			name:        "mixed case email domain",
			username:    "testuser",
			email:       "Test@EXAMPLE.COM",
			password:    "ValidPass123!",
			expectErr:   false,
			description: "Mixed case email should be valid",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.ValidateSignupRequest(tt.username, tt.email, tt.password)

			if tt.expectErr && err == nil {
				t.Errorf("%s: Expected error but got nil", tt.description)
			} else if !tt.expectErr && err != nil {
				t.Errorf("%s: Expected no error but got: %v", tt.description, err)
			}
		})
	}
}
