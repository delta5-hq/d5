package integration

import "backend-v2/internal/models"

type metadataFieldAccessor struct {
	llmProviderAccessors   map[string]llmMetadataExtractor
	arrayProviderAccessors map[string]arrayMetadataExtractor
}

type llmMetadataExtractor func(*models.SecretMetadata) *models.LLMSecretMetadata
type arrayMetadataExtractor func(*models.SecretMetadata) map[string]*models.ArrayItemSecretMetadata

func newMetadataFieldAccessor() metadataFieldAccessor {
	return metadataFieldAccessor{
		llmProviderAccessors: map[string]llmMetadataExtractor{
			"openai":     func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.OpenAI },
			"yandex":     func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.Yandex },
			"claude":     func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.Claude },
			"qwen":       func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.Qwen },
			"deepseek":   func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.Deepseek },
			"custom_llm": func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.CustomLLM },
			"perplexity": func(m *models.SecretMetadata) *models.LLMSecretMetadata { return m.Perplexity },
		},
		arrayProviderAccessors: map[string]arrayMetadataExtractor{
			"mcp": func(m *models.SecretMetadata) map[string]*models.ArrayItemSecretMetadata { return m.MCP },
			"rpc": func(m *models.SecretMetadata) map[string]*models.ArrayItemSecretMetadata { return m.RPC },
		},
	}
}

func (mfa metadataFieldAccessor) extractMetadataForField(
	metadata *models.SecretMetadata,
	fieldName string,
) interface{} {
	if metadata == nil {
		return nil
	}

	if llmExtractor, exists := mfa.llmProviderAccessors[fieldName]; exists {
		if llmMeta := llmExtractor(metadata); llmMeta != nil {
			return map[string]*models.LLMSecretMetadata{fieldName: llmMeta}
		}
		return nil
	}

	if arrayExtractor, exists := mfa.arrayProviderAccessors[fieldName]; exists {
		if arrayMeta := arrayExtractor(metadata); len(arrayMeta) > 0 {
			return map[string]map[string]*models.ArrayItemSecretMetadata{fieldName: arrayMeta}
		}
		return nil
	}

	return nil
}
