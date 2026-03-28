package encryption

import "fmt"

type DocumentTransformer struct {
	fieldTransformer *FieldTransformer
	contextBinder    *ContextBinder
}

func NewDocumentTransformer(fieldTransformer *FieldTransformer, contextBinder *ContextBinder) *DocumentTransformer {
	return &DocumentTransformer{
		fieldTransformer: fieldTransformer,
		contextBinder:    contextBinder,
	}
}

func (dt *DocumentTransformer) EncryptLLMField(doc map[string]interface{}, path string, serialize bool, encCtx EncryptionContext) error {
	ad := dt.contextBinder.BindLLMField(FieldContext{
		Encryption: encCtx,
		FieldPath:  path,
	})
	return dt.fieldTransformer.EncryptField(doc, path, serialize, ad)
}

func (dt *DocumentTransformer) DecryptLLMField(doc map[string]interface{}, path string, serialize bool, encCtx EncryptionContext) error {
	ad := dt.contextBinder.BindLLMField(FieldContext{
		Encryption: encCtx,
		FieldPath:  path,
	})
	return dt.fieldTransformer.DecryptField(doc, path, serialize, ad)
}

func (dt *DocumentTransformer) EncryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, encCtx EncryptionContext) error {
	return dt.transformArrayFields(doc, arrayPath, fieldConfigs, encCtx, true)
}

func (dt *DocumentTransformer) DecryptArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, encCtx EncryptionContext) error {
	return dt.transformArrayFields(doc, arrayPath, fieldConfigs, encCtx, false)
}

func (dt *DocumentTransformer) transformArrayFields(doc map[string]interface{}, arrayPath string, fieldConfigs []FieldConfig, encCtx EncryptionContext, encrypt bool) error {
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

		alias, ok := itemMap["alias"].(string)
		if !ok || alias == "" {
			return fmt.Errorf("array item missing alias in %s", arrayPath)
		}

		for _, config := range fieldConfigs {
			ad := dt.contextBinder.BindArrayField(ArrayFieldContext{
				Encryption: encCtx,
				ArrayName:  arrayPath,
				Alias:      alias,
				FieldPath:  config.Path,
			})

			if encrypt {
				if err := dt.fieldTransformer.EncryptField(itemMap, config.Path, config.Serialize, ad); err != nil {
					return err
				}
			} else {
				if err := dt.fieldTransformer.DecryptField(itemMap, config.Path, config.Serialize, ad); err != nil {
					return err
				}
			}
		}
	}

	return nil
}
