package integration

import "backend-v2/internal/common/encryption"

// DocumentEncryptor encrypts/decrypts Integration documents.
type DocumentEncryptor struct {
	transformer *encryption.FieldTransformer
	config      *EncryptionConfig
}

// NewDocumentEncryptor creates a document encryptor.
func NewDocumentEncryptor() (*DocumentEncryptor, error) {
	encryptionService, err := encryption.GetService()
	if err != nil {
		return nil, err
	}

	serializer := encryption.NewSerializer()
	transformer := encryption.NewFieldTransformer(encryptionService, serializer)

	return &DocumentEncryptor{
		transformer: transformer,
		config:      GetIntegrationEncryptionConfig(),
	}, nil
}

// Encrypt encrypts sensitive fields in Integration document.
func (de *DocumentEncryptor) Encrypt(doc map[string]interface{}) error {
	for _, path := range de.config.Fields {
		if err := de.transformer.EncryptField(doc, path, false); err != nil {
			return err
		}
	}

	for arrayName, fieldConfigs := range de.config.ArrayFields {
		if err := de.transformer.EncryptArrayFields(doc, arrayName, fieldConfigs); err != nil {
			return err
		}
	}

	return nil
}

// Decrypt decrypts sensitive fields in Integration document.
func (de *DocumentEncryptor) Decrypt(doc map[string]interface{}) error {
	for _, path := range de.config.Fields {
		if err := de.transformer.DecryptField(doc, path, false); err != nil {
			return err
		}
	}

	for arrayName, fieldConfigs := range de.config.ArrayFields {
		if err := de.transformer.DecryptArrayFields(doc, arrayName, fieldConfigs); err != nil {
			return err
		}
	}

	return nil
}
