package integration_test

import (
	"backend-v2/internal/modules/integration"
	"testing"
)

func TestArrayFieldRegistry(t *testing.T) {
	t.Run("RegisteredFieldsAreRecognized", func(t *testing.T) {
		for _, field := range []string{"mcp", "rpc"} {
			if !integration.IsArrayFieldRegistered(field) {
				t.Errorf("Expected field %s to be registered", field)
			}
		}
	})

	t.Run("UnregisteredFieldsAreRejected", func(t *testing.T) {
		for _, field := range []string{"unknown", "invalid", "openai", "claude", "", "MCP"} {
			if integration.IsArrayFieldRegistered(field) {
				t.Errorf("Field %q should not be registered", field)
			}
		}
	})
}
