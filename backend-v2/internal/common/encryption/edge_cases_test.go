package encryption

import (
	"strings"
	"testing"
)

// TestEdgeCase_EmptyAndNilValues validates handling of empty/nil data.
func TestEdgeCase_EmptyAndNilValues(t *testing.T) {
	service, _ := GetService()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "whitespace only",
			input: "   ",
			want:  "   ",
		},
		{
			name:  "newlines only",
			input: "\n\n\n",
			want:  "\n\n\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := service.Encrypt(tt.input)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			if tt.input == "" && encrypted != "" {
				t.Error("empty input should produce empty output")
			}

			decrypted, err := service.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.want {
				t.Errorf("decrypted = %q, want %q", decrypted, tt.want)
			}
		})
	}
}

// TestEdgeCase_BoundaryValues validates boundary conditions.
func TestEdgeCase_BoundaryValues(t *testing.T) {
	cipher := NewCipher()
	key := make([]byte, 32)
	copy(key, []byte("test-encryption-key-32-bytes!!!"))

	tests := []struct {
		name      string
		plaintext string
	}{
		{
			name:      "single byte",
			plaintext: "a",
		},
		{
			name:      "exactly 16 bytes (AES block size)",
			plaintext: "1234567890123456",
		},
		{
			name:      "17 bytes (one more than block)",
			plaintext: "12345678901234567",
		},
		{
			name:      "31 bytes",
			plaintext: strings.Repeat("x", 31),
		},
		{
			name:      "32 bytes (key size)",
			plaintext: strings.Repeat("x", 32),
		},
		{
			name:      "33 bytes",
			plaintext: strings.Repeat("x", 33),
		},
		{
			name:      "1KB",
			plaintext: strings.Repeat("x", 1024),
		},
		{
			name:      "10KB",
			plaintext: strings.Repeat("x", 10*1024),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := cipher.Encrypt(tt.plaintext, key)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			decrypted, err := cipher.Decrypt(encrypted, key)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("length mismatch: got %d, want %d", len(decrypted), len(tt.plaintext))
			}
		})
	}
}

// TestEdgeCase_SpecialCharacters validates handling of special characters.
func TestEdgeCase_SpecialCharacters(t *testing.T) {
	service, _ := GetService()

	tests := []struct {
		name  string
		input string
	}{
		{
			name:  "control characters",
			input: "\x00\x01\x02\x03\x04\x05",
		},
		{
			name:  "unicode emoji",
			input: "🔐🔑🛡️🚀💻",
		},
		{
			name:  "mixed scripts",
			input: "English 中文 العربية עברית Русский",
		},
		{
			name:  "zero-width characters",
			input: "test\u200B\u200C\u200Dvalue",
		},
		{
			name:  "right-to-left marks",
			input: "test\u202E\u202Dvalue",
		},
		{
			name:  "combining characters",
			input: "e\u0301\u0302\u0303", // é with multiple accents
		},
		{
			name:  "surrogate pairs",
			input: "𝕳𝖊𝖑𝖑𝖔", // Mathematical bold
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encrypted, err := service.Encrypt(tt.input)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			decrypted, err := service.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.input {
				t.Errorf("special character handling failed")
			}
		})
	}
}

// TestEdgeCase_FieldPathNavigation validates nested path edge cases.
func TestEdgeCase_FieldPathNavigation(t *testing.T) {
	service, _ := GetService()
	serializer := NewSerializer()
	transformer := NewFieldTransformer(service, serializer)

	tests := []struct {
		name string
		doc  map[string]interface{}
		path string
	}{
		{
			name: "deeply nested path",
			doc: map[string]interface{}{
				"a": map[string]interface{}{
					"b": map[string]interface{}{
						"c": map[string]interface{}{
							"d": map[string]interface{}{
								"e": "secret",
							},
						},
					},
				},
			},
			path: "a.b.c.d.e",
		},
		{
			name: "path with missing intermediate",
			doc: map[string]interface{}{
				"a": map[string]interface{}{
					"c": "secret",
				},
			},
			path: "a.b.c", // b doesn't exist
		},
		{
			name: "path to non-map value",
			doc: map[string]interface{}{
				"a": "string-value",
			},
			path: "a.b", // a is string, not map
		},
		{
			name: "empty path components",
			doc: map[string]interface{}{
				"": map[string]interface{}{
					"key": "value",
				},
			},
			path: ".key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic or error on invalid paths
			err := transformer.EncryptField(tt.doc, tt.path, false)
			if err != nil {
				t.Errorf("EncryptField should handle invalid paths gracefully: %v", err)
			}

			err = transformer.DecryptField(tt.doc, tt.path, false)
			if err != nil {
				t.Errorf("DecryptField should handle invalid paths gracefully: %v", err)
			}
		})
	}
}

// TestEdgeCase_ArrayFieldEdgeCases validates array field handling edge cases.
func TestEdgeCase_ArrayFieldEdgeCases(t *testing.T) {
	service, _ := GetService()
	serializer := NewSerializer()
	transformer := NewFieldTransformer(service, serializer)

	tests := []struct {
		name   string
		doc    map[string]interface{}
		array  string
		config []FieldConfig
	}{
		{
			name: "empty array",
			doc: map[string]interface{}{
				"items": []interface{}{},
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
		{
			name: "array with nil elements",
			doc: map[string]interface{}{
				"items": []interface{}{nil, nil},
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
		{
			name: "array with mixed types",
			doc: map[string]interface{}{
				"items": []interface{}{
					map[string]interface{}{"secret": "value"},
					"string-element",
					123,
					nil,
				},
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
		{
			name: "array with empty objects",
			doc: map[string]interface{}{
				"items": []interface{}{
					map[string]interface{}{},
					map[string]interface{}{},
				},
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
		{
			name: "non-existent array field",
			doc: map[string]interface{}{
				"other": "value",
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
		{
			name: "field is not an array",
			doc: map[string]interface{}{
				"items": "not-an-array",
			},
			array:  "items",
			config: []FieldConfig{{Path: "secret", Serialize: false}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Should not panic on edge cases
			err := transformer.EncryptArrayFields(tt.doc, tt.array, tt.config)
			if err != nil {
				t.Errorf("EncryptArrayFields should handle edge cases gracefully: %v", err)
			}

			err = transformer.DecryptArrayFields(tt.doc, tt.array, tt.config)
			if err != nil {
				t.Errorf("DecryptArrayFields should handle edge cases gracefully: %v", err)
			}
		})
	}
}

// TestEdgeCase_SerializationEdgeCases validates serialization edge cases.
func TestEdgeCase_SerializationEdgeCases(t *testing.T) {
	serializer := NewSerializer()

	tests := []struct {
		name  string
		value interface{}
	}{
		{
			name:  "nil value",
			value: nil,
		},
		{
			name:  "empty map",
			value: map[string]interface{}{},
		},
		{
			name:  "empty array",
			value: []interface{}{},
		},
		{
			name: "nested empty structures",
			value: map[string]interface{}{
				"empty_map":   map[string]interface{}{},
				"empty_array": []interface{}{},
			},
		},
		{
			name:  "map with nil values",
			value: map[string]interface{}{"key": nil},
		},
		{
			name:  "array with nil",
			value: []interface{}{nil, nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			serialized, err := serializer.Serialize(tt.value)
			if err != nil {
				t.Fatalf("Serialize failed: %v", err)
			}

			deserialized, err := serializer.Deserialize(serialized)
			if err != nil {
				t.Fatalf("Deserialize failed: %v", err)
			}

			// For nil, both should be empty string
			if tt.value == nil {
				if serialized != "" || deserialized != "" {
					t.Error("nil should serialize/deserialize to empty string")
				}
			}
		})
	}
}

// TestEdgeCase_KeyDerivationBoundaries validates key derivation edge cases.
func TestEdgeCase_KeyDerivationBoundaries(t *testing.T) {
	tests := []struct {
		name      string
		secret    string
		wantError bool
	}{
		{
			name:      "exactly 16 bytes (minimum)",
			secret:    "1234567890123456",
			wantError: false,
		},
		{
			name:      "15 bytes (below minimum)",
			secret:    "123456789012345",
			wantError: true,
		},
		{
			name:      "very long secret",
			secret:    strings.Repeat("x", 1000),
			wantError: false,
		},
		{
			name:      "secret with special characters",
			secret:    "!@#$%^&*()_+-=[]{}|;:',.<>?/~`",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			kd, err := NewKeyDerivation(tt.secret)
			if tt.wantError {
				if err == nil {
					t.Error("expected error for invalid secret")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
			if kd == nil {
				t.Error("expected valid key derivation")
			}
		})
	}
}

// TestEdgeCase_MarkingEdgeCases validates marking logic edge cases.
func TestEdgeCase_MarkingEdgeCases(t *testing.T) {
	marker := NewMarker()

	tests := []struct {
		name  string
		value string
	}{
		{
			name:  "value containing prefix in middle",
			value: "text__encrypted__more",
		},
		{
			name:  "prefix at end",
			value: "text__encrypted__",
		},
		{
			name:  "multiple prefixes",
			value: "__encrypted____encrypted__",
		},
		{
			name:  "partial prefix",
			value: "__encr",
		},
		{
			name:  "case variation",
			value: "__ENCRYPTED__",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isMarked := marker.IsMarked(tt.value)

			// Only values starting with exact prefix should be marked
			shouldBeMarked := strings.HasPrefix(tt.value, "__encrypted__")
			if isMarked != shouldBeMarked {
				t.Errorf("IsMarked(%q) = %v, want %v", tt.value, isMarked, shouldBeMarked)
			}
		})
	}
}
