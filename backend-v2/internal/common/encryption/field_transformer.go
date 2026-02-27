package encryption

import (
	"fmt"
	"strings"
)

// FieldConfig defines encryption behavior for a single field.
type FieldConfig struct {
	Path      string
	Serialize bool
}

// FieldTransformer applies encryption/decryption to document fields.
type FieldTransformer struct {
	service    *Service
	serializer *Serializer
}

// NewFieldTransformer creates a field transformer instance.
func NewFieldTransformer(service *Service, serializer *Serializer) *FieldTransformer {
	return &FieldTransformer{
		service:    service,
		serializer: serializer,
	}
}

// EncryptField encrypts a single field in document by path.
func (ft *FieldTransformer) EncryptField(doc map[string]interface{}, path string, serialize bool) error {
	return ft.transformField(doc, path, serialize, true)
}

// DecryptField decrypts a single field in document by path.
func (ft *FieldTransformer) DecryptField(doc map[string]interface{}, path string, serialize bool) error {
	return ft.transformField(doc, path, serialize, false)
}

func (ft *FieldTransformer) transformField(doc map[string]interface{}, path string, serialize bool, encrypt bool) error {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil
	}

	// Navigate to parent
	current := doc
	for i := 0; i < len(parts)-1; i++ {
		next, ok := current[parts[i]]
		if !ok {
			return nil // Path doesn't exist, skip
		}

		nextMap, ok := next.(map[string]interface{})
		if !ok {
			return nil // Not a map, can't navigate further
		}

		current = nextMap
	}

	// Transform leaf field
	fieldName := parts[len(parts)-1]
	value, exists := current[fieldName]
	if !exists || value == nil {
		return nil
	}

	transformed, err := ft.transformValue(value, serialize, encrypt)
	if err != nil {
		return fmt.Errorf("transform field %s: %w", path, err)
	}

	current[fieldName] = transformed
	return nil
}

func (ft *FieldTransformer) transformValue(value interface{}, serialize bool, encrypt bool) (interface{}, error) {
	// Convert value to string (with optional serialization)
	var strValue string
	var err error

	if serialize {
		strValue, err = ft.serializer.Serialize(value)
		if err != nil {
			return nil, err
		}
	} else {
		strValue, _ = value.(string)
		if strValue == "" && value != nil {
			// Non-string value without serialization, return as-is
			return value, nil
		}
	}

	// Encrypt or decrypt
	var result string
	if encrypt {
		result, err = ft.service.Encrypt(strValue)
	} else {
		result, err = ft.service.Decrypt(strValue)
		if err != nil {
			return nil, err
		}

		// Deserialize if needed
		if serialize {
			return ft.serializer.Deserialize(result)
		}
	}

	return result, err
}

// EncryptArrayFields encrypts specified fields in all array elements.
func (ft *FieldTransformer) EncryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig) error {
	return ft.transformArrayFields(doc, arrayPath, fieldConfigs, true)
}

// DecryptArrayFields decrypts specified fields in all array elements.
func (ft *FieldTransformer) DecryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig) error {
	return ft.transformArrayFields(doc, arrayPath, fieldConfigs, false)
}

func (ft *FieldTransformer) transformArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, encrypt bool) error {
	array, ok := doc[arrayPath]
	if !ok {
		return nil // Array doesn't exist, skip
	}

	arraySlice, ok := array.([]interface{})
	if !ok {
		return nil // Not an array, skip
	}

	for _, item := range arraySlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue // Array element is not a map, skip
		}

		for _, config := range fieldConfigs {
			if encrypt {
				if err := ft.EncryptField(itemMap, config.Path, config.Serialize); err != nil {
					return err
				}
			} else {
				if err := ft.DecryptField(itemMap, config.Path, config.Serialize); err != nil {
					return err
				}
			}
		}
	}

	return nil
}
