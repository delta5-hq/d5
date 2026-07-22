package integration

import (
	"backend-v2/internal/common/encryption"
	"fmt"
)

type FieldCrypto struct {
	service       *encryption.Service
	serializer    *encryption.Serializer
	contextBinder *encryption.ContextBinder
	config        *EncryptionConfig
}

func NewFieldCrypto() (*FieldCrypto, error) {
	service, err := encryption.GetService()
	if err != nil {
		return nil, err
	}

	return &FieldCrypto{
		service:       service,
		serializer:    encryption.NewSerializer(),
		contextBinder: encryption.NewContextBinder(),
		config:        GetIntegrationEncryptionConfig(),
	}, nil
}

func (fc *FieldCrypto) EncryptArrayFieldUpdate(scope ScopeIdentifier, arrayName, alias, fieldName string, value interface{}) (interface{}, error) {
	fieldConfigs, exists := fc.config.ArrayFields[arrayName]
	if !exists {
		return value, nil
	}

	for _, config := range fieldConfigs {
		if config.Path == fieldName {
			return fc.encryptFieldValue(scope, arrayName, alias, fieldName, value, config.Serialize)
		}
	}

	return value, nil
}

func (fc *FieldCrypto) encryptFieldValue(scope ScopeIdentifier, arrayName, alias, fieldName string, value interface{}, serialize bool) (interface{}, error) {
	if value == nil {
		return nil, nil
	}

	var strValue string
	var err error

	if serialize {
		strValue, err = fc.serializer.Serialize(value)
		if err != nil {
			return nil, err
		}
	} else {
		strValue, _ = value.(string)
		if strValue == "" && value != nil {
			return value, nil
		}
	}

	workflowID := ""
	if scope.WorkflowID != nil {
		workflowID = *scope.WorkflowID
	}

	ad := fc.contextBinder.BindArrayField(encryption.ArrayFieldContext{
		Encryption: encryption.EncryptionContext{
			UserID:     scope.UserID,
			WorkflowID: workflowID,
		},
		ArrayName: arrayName,
		Alias:     alias,
		FieldPath: fieldName,
	})

	encrypted, err := fc.service.Encrypt(strValue, ad)
	if err != nil {
		return nil, fmt.Errorf("encrypt field value: %w", err)
	}

	return encrypted, nil
}
