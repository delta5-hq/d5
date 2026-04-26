package encryption

import (
	"encoding/binary"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestADBuilder_BuildForLLMField(t *testing.T) {
	builder := NewADBuilder()

	t.Run("builds AD with all parts present", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")

		parts := parseAD(ad)
		assert.Equal(t, []string{"integrations", "user-123", "workflow-456", "openai.apiKey"}, parts)
	})

	t.Run("normalizes empty workflowID to empty string", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-123", "", "openai.apiKey")

		parts := parseAD(ad)
		assert.Equal(t, []string{"integrations", "user-123", "", "openai.apiKey"}, parts)
	})

	t.Run("preserves workflowID when present", func(t *testing.T) {
		ad := builder.BuildForLLMField("user-123", "workflow-789", "claude.apiKey")

		parts := parseAD(ad)
		assert.Equal(t, []string{"integrations", "user-123", "workflow-789", "claude.apiKey"}, parts)
	})
}

func TestADBuilder_BuildForArrayField(t *testing.T) {
	builder := NewADBuilder()

	t.Run("builds AD with all parts present", func(t *testing.T) {
		ad := builder.BuildForArrayField("user-123", "workflow-456", "mcp", "my-server", "headers")

		parts := parseAD(ad)
		assert.Equal(t, []string{"integrations", "user-123", "workflow-456", "mcp", "my-server", "headers"}, parts)
	})

	t.Run("normalizes empty workflowID to empty string", func(t *testing.T) {
		ad := builder.BuildForArrayField("user-123", "", "rpc", "ssh-host", "privateKey")

		parts := parseAD(ad)
		assert.Equal(t, []string{"integrations", "user-123", "", "rpc", "ssh-host", "privateKey"}, parts)
	})
}

func TestADBuilder_ByteFormat(t *testing.T) {
	builder := NewADBuilder()

	t.Run("produces correct binary format for single part", func(t *testing.T) {
		ad := builder.build("test")

		assert.Equal(t, uint32(4), binary.BigEndian.Uint32(ad[0:4]))
		assert.Equal(t, "test", string(ad[4:8]))
	})

	t.Run("produces correct binary format for multiple parts", func(t *testing.T) {
		ad := builder.build("part1", "part2")

		// First part
		length1 := binary.BigEndian.Uint32(ad[0:4])
		assert.Equal(t, uint32(5), length1)
		assert.Equal(t, "part1", string(ad[4:9]))

		// Second part
		length2 := binary.BigEndian.Uint32(ad[9:13])
		assert.Equal(t, uint32(5), length2)
		assert.Equal(t, "part2", string(ad[13:18]))
	})

	t.Run("handles empty parts correctly", func(t *testing.T) {
		ad := builder.build("before", "", "after")

		parts := parseAD(ad)
		assert.Equal(t, []string{"before", "", "after"}, parts)
	})

	t.Run("handles UTF-8 correctly", func(t *testing.T) {
		ad := builder.build("user-🔒", "field-名前")

		parts := parseAD(ad)
		assert.Equal(t, []string{"user-🔒", "field-名前"}, parts)
	})
}

func TestADBuilder_CrossBackendCompatibility(t *testing.T) {
	builder := NewADBuilder()

	t.Run("produces deterministic output for same inputs", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-123", "workflow-456", "openai.apiKey")

		assert.Equal(t, ad1, ad2)
	})

	t.Run("produces different output for different users", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-A", "workflow-1", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-B", "workflow-1", "openai.apiKey")

		assert.NotEqual(t, ad1, ad2)
	})

	t.Run("produces different output for different workflows", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-1", "workflow-A", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-1", "workflow-B", "openai.apiKey")

		assert.NotEqual(t, ad1, ad2)
	})

	t.Run("produces different output for different fields", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-1", "workflow-1", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-1", "workflow-1", "claude.apiKey")

		assert.NotEqual(t, ad1, ad2)
	})

	t.Run("produces different output for user-level vs workflow-scoped", func(t *testing.T) {
		ad1 := builder.BuildForLLMField("user-1", "", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-1", "workflow-1", "openai.apiKey")

		assert.NotEqual(t, ad1, ad2)
	})
}

func parseAD(ad []byte) []string {
	parts := []string{}
	offset := 0

	for offset < len(ad) {
		if offset+4 > len(ad) {
			break
		}

		length := binary.BigEndian.Uint32(ad[offset : offset+4])
		offset += 4

		if offset+int(length) > len(ad) {
			break
		}

		part := string(ad[offset : offset+int(length)])
		parts = append(parts, part)
		offset += int(length)
	}

	return parts
}
