package integration

import (
	"backend-v2/internal/common/encryption"
	"fmt"
)

// FieldCrypto provides single-field encryption for MongoDB positional updates.
type FieldCrypto struct {
	transformer *encryption.FieldTransformer
	config      *EncryptionConfig
}

func NewFieldCrypto() (*FieldCrypto, error) {
	encryptionService, err := encryption.GetService()
	if err != nil {
		return nil, err
	}

	serializer := encryption.NewSerializer()
	transformer := encryption.NewFieldTransformer(encryptionService, serializer)

	return &FieldCrypto{
		transformer: transformer,
		config:      GetIntegrationEncryptionConfig(),
	}, nil
}

// EncryptArrayFieldUpdate encrypts a single field value for positional array update.
// Returns encrypted value if field should be encrypted, original value otherwise.
func (fc *FieldCrypto) EncryptArrayFieldUpdate(arrayName, fieldName string, value interface{}) (interface{}, error) {
	fieldConfigs, exists := fc.config.ArrayFields[arrayName]
	if !exists {
		return value, nil
	}

	for _, config := range fieldConfigs {
		if config.Path == fieldName {
			return fc.encryptFieldValue(value, config.Serialize)
		}
	}

	return value, nil
}

func (fc *FieldCrypto) encryptFieldValue(value interface{}, serialize bool) (interface{}, error) {
	if value == nil {
		return nil, nil
	}

	tempDoc := map[string]interface{}{"field": value}
	if err := fc.transformer.EncryptField(tempDoc, "field", serialize); err != nil {
		return nil, fmt.Errorf("encrypt field value: %w", err)
	}

	return tempDoc["field"], nil
}
