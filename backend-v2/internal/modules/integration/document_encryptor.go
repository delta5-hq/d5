package integration

import "backend-v2/internal/common/encryption"

type DocumentEncryptor struct {
	docTransformer *encryption.DocumentTransformer
	config         *EncryptionConfig
}

func NewDocumentEncryptor() (*DocumentEncryptor, error) {
	encryptionService, err := encryption.GetService()
	if err != nil {
		return nil, err
	}

	serializer := encryption.NewSerializer()
	fieldTransformer := encryption.NewFieldTransformer(encryptionService, serializer)
	contextBinder := encryption.NewContextBinder()
	docTransformer := encryption.NewDocumentTransformer(fieldTransformer, contextBinder)

	return &DocumentEncryptor{
		docTransformer: docTransformer,
		config:         GetIntegrationEncryptionConfig(),
	}, nil
}

func (de *DocumentEncryptor) Encrypt(doc map[string]interface{}, userID string, workflowID *string) error {
	encCtx := de.buildEncryptionContext(userID, workflowID)

	for _, path := range de.config.Fields {
		if err := de.docTransformer.EncryptLLMField(doc, path, false, encCtx); err != nil {
			return err
		}
	}

	for arrayName, fieldConfigs := range de.config.ArrayFields {
		if err := de.docTransformer.EncryptArrayFields(doc, arrayName, fieldConfigs, encCtx); err != nil {
			return err
		}
	}

	return nil
}

func (de *DocumentEncryptor) Decrypt(doc map[string]interface{}, userID string, workflowID *string) error {
	encCtx := de.buildEncryptionContext(userID, workflowID)

	for _, path := range de.config.Fields {
		if err := de.docTransformer.DecryptLLMField(doc, path, false, encCtx); err != nil {
			return err
		}
	}

	for arrayName, fieldConfigs := range de.config.ArrayFields {
		if err := de.docTransformer.DecryptArrayFields(doc, arrayName, fieldConfigs, encCtx); err != nil {
			return err
		}
	}

	return nil
}

func (de *DocumentEncryptor) buildEncryptionContext(userID string, workflowID *string) encryption.EncryptionContext {
	wfID := ""
	if workflowID != nil {
		wfID = *workflowID
	}
	return encryption.EncryptionContext{
		UserID:     userID,
		WorkflowID: wfID,
	}
}
