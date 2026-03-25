package integration

import (
	"backend-v2/internal/models"
	"encoding/json"
	"fmt"
)

type ServiceFieldExtractor struct {
	secretRedactor *SecretRedactor
}

func NewServiceFieldExtractor(secretRedactor *SecretRedactor) *ServiceFieldExtractor {
	return &ServiceFieldExtractor{
		secretRedactor: secretRedactor,
	}
}

func (e *ServiceFieldExtractor) ExtractSecureServiceField(
	integration *models.Integration,
	fieldName string,
) (map[string]interface{}, error) {
	metadata := e.secretRedactor.BuildMetadataFromIntegration(integration)
	e.secretRedactor.RedactSecretsFromIntegration(integration)

	integrationBytes, err := json.Marshal(integration)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal integration: %w", err)
	}

	var integrationMap map[string]interface{}
	if err := json.Unmarshal(integrationBytes, &integrationMap); err != nil {
		return nil, fmt.Errorf("failed to unmarshal integration: %w", err)
	}

	fieldValue, exists := integrationMap[fieldName]
	if !exists {
		return map[string]interface{}{
			fieldName: nil,
		}, nil
	}

	response := map[string]interface{}{
		fieldName: fieldValue,
	}

	if e.hasSecretMetadataForField(metadata, fieldName) {
		response["secretsMeta"] = e.extractFieldMetadata(metadata, fieldName)
	}

	return response, nil
}

func (e *ServiceFieldExtractor) hasSecretMetadataForField(
	metadata *models.SecretMetadata,
	fieldName string,
) bool {
	if metadata == nil {
		return false
	}

	switch fieldName {
	case "openai":
		return metadata.OpenAI != nil
	case "yandex":
		return metadata.Yandex != nil
	case "claude":
		return metadata.Claude != nil
	case "qwen":
		return metadata.Qwen != nil
	case "deepseek":
		return metadata.Deepseek != nil
	case "custom_llm":
		return metadata.CustomLLM != nil
	case "perplexity":
		return metadata.Perplexity != nil
	case "mcp":
		return len(metadata.MCP) > 0
	case "rpc":
		return len(metadata.RPC) > 0
	default:
		return false
	}
}

func (e *ServiceFieldExtractor) extractFieldMetadata(
	metadata *models.SecretMetadata,
	fieldName string,
) interface{} {
	switch fieldName {
	case "openai":
		return map[string]*models.LLMSecretMetadata{"openai": metadata.OpenAI}
	case "yandex":
		return map[string]*models.LLMSecretMetadata{"yandex": metadata.Yandex}
	case "claude":
		return map[string]*models.LLMSecretMetadata{"claude": metadata.Claude}
	case "qwen":
		return map[string]*models.LLMSecretMetadata{"qwen": metadata.Qwen}
	case "deepseek":
		return map[string]*models.LLMSecretMetadata{"deepseek": metadata.Deepseek}
	case "custom_llm":
		return map[string]*models.LLMSecretMetadata{"custom_llm": metadata.CustomLLM}
	case "perplexity":
		return map[string]*models.LLMSecretMetadata{"perplexity": metadata.Perplexity}
	case "mcp":
		return map[string]map[string]*models.ArrayItemSecretMetadata{"mcp": metadata.MCP}
	case "rpc":
		return map[string]map[string]*models.ArrayItemSecretMetadata{"rpc": metadata.RPC}
	default:
		return nil
	}
}
