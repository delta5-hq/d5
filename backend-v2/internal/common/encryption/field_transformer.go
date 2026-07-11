package encryption

import (
	"fmt"
	"strings"
)

type FieldConfig struct {
	Path      string
	Serialize bool
}

type FieldTransformer struct {
	service    *Service
	serializer *Serializer
}

func NewFieldTransformer(service *Service, serializer *Serializer) *FieldTransformer {
	return &FieldTransformer{
		service:    service,
		serializer: serializer,
	}
}

func (ft *FieldTransformer) EncryptField(doc map[string]interface{}, path string, serialize bool, additionalData []byte) error {
	return ft.transformField(doc, path, serialize, true, additionalData)
}

func (ft *FieldTransformer) DecryptField(doc map[string]interface{}, path string, serialize bool, additionalData []byte) error {
	return ft.transformField(doc, path, serialize, false, additionalData)
}

func (ft *FieldTransformer) transformField(doc map[string]interface{}, path string, serialize bool, encrypt bool, additionalData []byte) error {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil
	}

	current := doc
	for i := 0; i < len(parts)-1; i++ {
		next, ok := current[parts[i]]
		if !ok {
			return nil
		}

		nextMap, ok := next.(map[string]interface{})
		if !ok {
			return nil
		}

		current = nextMap
	}

	fieldName := parts[len(parts)-1]
	value, exists := current[fieldName]
	if !exists || value == nil {
		return nil
	}

	transformed, err := ft.transformValue(value, serialize, encrypt, additionalData)
	if err != nil {
		return fmt.Errorf("transform field %s: %w", path, err)
	}

	current[fieldName] = transformed
	return nil
}

func (ft *FieldTransformer) transformValue(value interface{}, serialize bool, encrypt bool, additionalData []byte) (interface{}, error) {
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
			return value, nil
		}
	}

	var result string
	if encrypt {
		result, err = ft.service.Encrypt(strValue, additionalData)
	} else {
		result, err = ft.service.Decrypt(strValue, additionalData)
		if err != nil {
			return nil, err
		}

		if serialize {
			return ft.serializer.Deserialize(result)
		}
	}

	return result, err
}

func (ft *FieldTransformer) EncryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, additionalData []byte) error {
	return ft.transformArrayFields(doc, arrayPath, fieldConfigs, true, additionalData)
}

func (ft *FieldTransformer) DecryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, additionalData []byte) error {
	return ft.transformArrayFields(doc, arrayPath, fieldConfigs, false, additionalData)
}

func (ft *FieldTransformer) transformArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, encrypt bool, additionalData []byte) error {
	array, ok := doc[arrayPath]
	if !ok {
		return nil
	}

	arraySlice, ok := array.([]interface{})
	if !ok {
		return nil
	}

	for _, item := range arraySlice {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		for _, config := range fieldConfigs {
			if encrypt {
				if err := ft.EncryptField(itemMap, config.Path, config.Serialize, additionalData); err != nil {
					return err
				}
			} else {
				if err := ft.DecryptField(itemMap, config.Path, config.Serialize, additionalData); err != nil {
					return err
				}
			}
		}
	}

	return nil
}
