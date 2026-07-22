package encryption

import "encoding/json"

// Serializer handles object-to-string conversion for encryption.
type Serializer struct{}

// NewSerializer creates a serializer instance.
func NewSerializer() *Serializer {
	return &Serializer{}
}

// Serialize converts objects to JSON strings for encryption.
// Non-object values are returned as-is.
func (s *Serializer) Serialize(value interface{}) (string, error) {
	if value == nil {
		return "", nil
	}

	// If already string, return as-is
	if str, ok := value.(string); ok {
		return str, nil
	}

	// Serialize objects/maps to JSON
	bytes, err := json.Marshal(value)
	if err != nil {
		return "", err
	}

	return string(bytes), nil
}

// Deserialize converts JSON strings back to objects.
// Non-JSON strings are returned as-is.
func (s *Serializer) Deserialize(value string) (interface{}, error) {
	if value == "" {
		return value, nil
	}

	// Try parsing as JSON
	var result interface{}
	if err := json.Unmarshal([]byte(value), &result); err != nil {
		// Not JSON, return as string
		return value, nil
	}

	return result, nil
}
