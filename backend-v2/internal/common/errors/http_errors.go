package errors

import "fmt"

type HTTPError struct {
	Status  int
	Message string
}

func (e *HTTPError) Error() string {
	return fmt.Sprintf("%d: %s", e.Status, e.Message)
}

func NewHTTPError(status int, msg string) *HTTPError {
	return &HTTPError{
		Status:  status,
		Message: msg,
	}
}
