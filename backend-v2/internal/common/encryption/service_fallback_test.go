package encryption

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestService_DecryptFallbackBehavior(t *testing.T) {
	service, err := GetService()
	require.NoError(t, err)

	t.Run("decrypts legacy nil-AD data when AD is provided", func(t *testing.T) {
		legacyEncrypted, err := service.Encrypt("legacy-secret", nil)
		require.NoError(t, err)

		builder := NewADBuilder()
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		decrypted, err := service.Decrypt(legacyEncrypted, ad)
		require.NoError(t, err)
		assert.Equal(t, "legacy-secret", decrypted)
	})

	t.Run("decrypts AD-bound data with correct AD", func(t *testing.T) {
		builder := NewADBuilder()
		ad := builder.BuildForLLMField("user-1", "", "openai.apiKey")

		encrypted, err := service.Encrypt("modern-secret", ad)
		require.NoError(t, err)

		decrypted, err := service.Decrypt(encrypted, ad)
		require.NoError(t, err)
		assert.Equal(t, "modern-secret", decrypted)
	})

	t.Run("fails when both AD and nil fail", func(t *testing.T) {
		builder := NewADBuilder()
		ad1 := builder.BuildForLLMField("user-1", "", "openai.apiKey")
		ad2 := builder.BuildForLLMField("user-2", "", "openai.apiKey")

		encrypted, err := service.Encrypt("secret", ad1)
		require.NoError(t, err)

		_, err = service.Decrypt(encrypted, ad2)
		assert.Error(t, err)
	})
}
