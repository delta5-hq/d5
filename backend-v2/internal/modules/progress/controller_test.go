package progress

import (
	"testing"
)

func TestNewController(t *testing.T) {
	controller := NewController()

	if controller == nil {
		t.Fatal("NewController() returned nil")
	}
}
