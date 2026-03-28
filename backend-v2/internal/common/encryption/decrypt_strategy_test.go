package encryption

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFallbackDecrypt_SucceedsWithMatchingAD(t *testing.T) {
	cipher := NewCipher()
	fallback := NewFallbackDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))
	ad := []byte("context")

	encrypted, err := cipher.Encrypt("secret", key, ad)
	require.NoError(t, err)

	decrypted, err := fallback.Decrypt(encrypted, key, ad)
	require.NoError(t, err)
	assert.Equal(t, "secret", decrypted)
}

func TestFallbackDecrypt_FallsBackToNilWhenADMismatches(t *testing.T) {
	cipher := NewCipher()
	fallback := NewFallbackDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))

	encryptedWithNil, err := cipher.Encrypt("legacy-secret", key, nil)
	require.NoError(t, err)

	wrongAD := []byte("wrong-context")
	decrypted, err := fallback.Decrypt(encryptedWithNil, key, wrongAD)
	require.NoError(t, err)
	assert.Equal(t, "legacy-secret", decrypted)
}

func TestFallbackDecrypt_FailsWhenBothADAndNilFail(t *testing.T) {
	cipher := NewCipher()
	fallback := NewFallbackDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))
	ad := []byte("context")

	encrypted, err := cipher.Encrypt("secret", key, ad)
	require.NoError(t, err)

	wrongKey := make([]byte, 32)
	copy(wrongKey, []byte("different-key-32-bytes-padding!!"))

	_, err = fallback.Decrypt(encrypted, wrongKey, []byte("any-ad"))
	assert.Error(t, err)
}

func TestFallbackDecrypt_NoFallbackWhenADIsNil(t *testing.T) {
	cipher := NewCipher()
	fallback := NewFallbackDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))
	ad := []byte("context")

	encryptedWithAD, err := cipher.Encrypt("secret", key, ad)
	require.NoError(t, err)

	_, err = fallback.Decrypt(encryptedWithAD, key, nil)
	assert.Error(t, err)
}

func TestStandardDecrypt_NeverFallsBack(t *testing.T) {
	cipher := NewCipher()
	standard := NewStandardDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))

	encryptedWithNil, err := cipher.Encrypt("legacy-secret", key, nil)
	require.NoError(t, err)

	wrongAD := []byte("wrong-context")
	_, err = standard.Decrypt(encryptedWithNil, key, wrongAD)
	assert.Error(t, err)
}

func TestDecryptStrategy_Symmetry(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))

	strategies := map[string]DecryptStrategy{
		"FallbackDecrypt": NewFallbackDecrypt(cipher),
		"StandardDecrypt": NewStandardDecrypt(cipher),
	}

	testCases := []struct {
		name      string
		plaintext string
		ad        []byte
	}{
		{"nil AD", "secret-nil", nil},
		{"empty AD", "secret-empty", []byte{}},
		{"non-empty AD", "secret-context", []byte("context-data")},
		{"unicode plaintext", "секрет-🔐", []byte("unicode-context")},
	}

	for strategyName, strategy := range strategies {
		t.Run(strategyName, func(t *testing.T) {
			for _, tc := range testCases {
				t.Run(tc.name, func(t *testing.T) {
					encrypted, err := cipher.Encrypt(tc.plaintext, key, tc.ad)
					require.NoError(t, err)

					decrypted, err := strategy.Decrypt(encrypted, key, tc.ad)
					require.NoError(t, err)
					assert.Equal(t, tc.plaintext, decrypted)
				})
			}
		})
	}
}

func TestDecryptStrategy_DifferentInstances(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))
	ad := []byte("context")

	encrypted, err := cipher.Encrypt("secret", key, ad)
	require.NoError(t, err)

	t.Run("multiple FallbackDecrypt instances behave identically", func(t *testing.T) {
		fallback1 := NewFallbackDecrypt(cipher)
		fallback2 := NewFallbackDecrypt(cipher)

		decrypted1, err1 := fallback1.Decrypt(encrypted, key, ad)
		decrypted2, err2 := fallback2.Decrypt(encrypted, key, ad)

		require.NoError(t, err1)
		require.NoError(t, err2)
		assert.Equal(t, decrypted1, decrypted2)
	})

	t.Run("multiple StandardDecrypt instances behave identically", func(t *testing.T) {
		standard1 := NewStandardDecrypt(cipher)
		standard2 := NewStandardDecrypt(cipher)

		decrypted1, err1 := standard1.Decrypt(encrypted, key, ad)
		decrypted2, err2 := standard2.Decrypt(encrypted, key, ad)

		require.NoError(t, err1)
		require.NoError(t, err2)
		assert.Equal(t, decrypted1, decrypted2)
	})
}

func TestFallbackDecrypt_EdgeCases(t *testing.T) {
	cipher := NewCipher()
	fallback := NewFallbackDecrypt(cipher)
	key := make([]byte, 32)
	copy(key, []byte("test-key-32-bytes-long-padding!!"))

	t.Run("empty AD and nil AD are GCM-equivalent for fallback", func(t *testing.T) {
		encryptedWithNil, err := cipher.Encrypt("secret", key, nil)
		require.NoError(t, err)

		decryptedWithEmpty, err := fallback.Decrypt(encryptedWithNil, key, []byte{})
		require.NoError(t, err)
		assert.Equal(t, "secret", decryptedWithEmpty)
	})

	t.Run("fallback only triggers when AD is non-nil", func(t *testing.T) {
		encryptedWithAD, err := cipher.Encrypt("secret", key, []byte("context"))
		require.NoError(t, err)

		_, err = fallback.Decrypt(encryptedWithAD, key, nil)
		assert.Error(t, err, "should not fallback when caller provides nil AD")
	})

	t.Run("fallback propagates original error when both attempts fail", func(t *testing.T) {
		wrongKey := make([]byte, 32)
		copy(wrongKey, []byte("wrong-key-32-bytes-long-padding!"))

		encrypted, err := cipher.Encrypt("secret", key, []byte("context"))
		require.NoError(t, err)

		_, err = fallback.Decrypt(encrypted, wrongKey, []byte("any-ad"))
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "authentication")
	})
}
