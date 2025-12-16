package auth

import (
	"regexp"
	"strings"
)

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

type SignupValidator struct {
	emailPattern      *regexp.Regexp
	minPasswordLength int
}

func NewSignupValidator() *SignupValidator {
	return &SignupValidator{
		emailPattern:      regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`),
		minPasswordLength: 7,
	}
}

func (v *SignupValidator) ValidateEmail(email string) *ValidationError {
	if email == "" {
		return &ValidationError{
			Field:   "email",
			Message: "Email is required",
		}
	}

	if !v.emailPattern.MatchString(email) {
		return &ValidationError{
			Field:   "email",
			Message: "Invalid email format. Email must be valid (e.g., user@example.com)",
		}
	}

	return nil
}

func (v *SignupValidator) ValidateUsername(username string) *ValidationError {
	if username == "" {
		return &ValidationError{
			Field:   "username",
			Message: "Username is required",
		}
	}

	if strings.Contains(username, "@") {
		return &ValidationError{
			Field:   "username",
			Message: "Invalid username. Username must not contain @ symbol",
		}
	}

	return nil
}

func (v *SignupValidator) ValidatePassword(password string) *ValidationError {
	if password == "" {
		return &ValidationError{
			Field:   "password",
			Message: "Password is required",
		}
	}

	if len(password) < v.minPasswordLength {
		return &ValidationError{
			Field:   "password",
			Message: "Password must be at least 7 characters long",
		}
	}

	return nil
}

func (v *SignupValidator) ValidateSignupRequest(username, email, password string) *ValidationError {
	if err := v.ValidateUsername(username); err != nil {
		return err
	}

	if err := v.ValidateEmail(email); err != nil {
		return err
	}

	if err := v.ValidatePassword(password); err != nil {
		return err
	}

	return nil
}
