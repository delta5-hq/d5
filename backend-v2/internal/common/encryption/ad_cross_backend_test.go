package encryption

import (
	"encoding/hex"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestADBuilder_CrossBackendByteCompatibility(t *testing.T) {
	builder := NewADBuilder()

	t.Run("LLM field AD matches Node.js exactly", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")

		expectedHex := "0000000c696e746567726174696f6e7300000008757365722d3132330000000c776f726b666c6f772d3435360000000d6f70656e61692e6170694b6579"

		assert.Equal(t, expectedHex, hex.EncodeToString(ad))
	})

	t.Run("array field AD with null workflowId matches Node.js exactly", func(t *testing.T) {
		ad := builder.BuildForArrayField("user-1", "", "mcp", "srv", "headers")

		expectedHex := "0000000c696e746567726174696f6e7300000006757365722d3100000000000000036d6370000000037372760000000768656164657273"

		assert.Equal(t, expectedHex, hex.EncodeToString(ad))
	})

	t.Run("handles UTF-8 correctly matching Node.js", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-🔒", "", "field-名前")

		expectedHex := "0000000c696e746567726174696f6e7300000009757365722df09f9492000000000000000c6669656c642de5908de5898d"

		assert.Equal(t, expectedHex, hex.EncodeToString(ad))
	})
}
