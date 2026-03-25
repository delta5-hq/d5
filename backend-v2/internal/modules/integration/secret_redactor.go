package integration

import (
	"backend-v2/internal/common/encryption"
	"backend-v2/internal/models"
)

type SecretRedactor struct {
	config *EncryptionConfig
}

func NewSecretRedactor() *SecretRedactor {
	return &SecretRedactor{
		config: GetIntegrationEncryptionConfig(),
	}
}

func (sr *SecretRedactor) BuildMetadataFromIntegration(integration *models.Integration) *models.SecretMetadata {
	meta := &models.SecretMetadata{}

	if integration.OpenAI != nil && integration.OpenAI.APIKey != "" {
		meta.OpenAI = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.Yandex != nil && integration.Yandex.APIKey != "" {
		meta.Yandex = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.Claude != nil && integration.Claude.APIKey != "" {
		meta.Claude = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.Qwen != nil && integration.Qwen.APIKey != "" {
		meta.Qwen = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.Deepseek != nil && integration.Deepseek.APIKey != "" {
		meta.Deepseek = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.CustomLLM != nil && integration.CustomLLM.APIKey != "" {
		meta.CustomLLM = &models.LLMSecretMetadata{APIKey: true}
	}
	if integration.Perplexity != nil && integration.Perplexity.APIKey != "" {
		meta.Perplexity = &models.LLMSecretMetadata{APIKey: true}
	}

	if len(integration.MCP) > 0 {
		meta.MCP = sr.buildArrayMetadata(integration.MCP, "mcp")
	}

	if len(integration.RPC) > 0 {
		meta.RPC = sr.buildArrayMetadata(integration.RPC, "rpc")
	}

	return meta
}

func (sr *SecretRedactor) buildArrayMetadata(items interface{}, arrayName string) map[string]*models.ArrayItemSecretMetadata {
	fieldConfigs, exists := sr.config.ArrayFields[arrayName]
	if !exists {
		return nil
	}

	metadata := make(map[string]*models.ArrayItemSecretMetadata)

	switch arrayName {
	case "mcp":
		mcpItems, ok := items.([]models.MCPIntegrationConfig)
		if !ok {
			return nil
		}
		for _, item := range mcpItems {
			itemMeta := sr.buildMCPItemMetadata(item, fieldConfigs)
			if itemMeta != nil {
				metadata[item.Alias] = itemMeta
			}
		}
	case "rpc":
		rpcItems, ok := items.([]models.RPCIntegrationConfig)
		if !ok {
			return nil
		}
		for _, item := range rpcItems {
			itemMeta := sr.buildRPCItemMetadata(item, fieldConfigs)
			if itemMeta != nil {
				metadata[item.Alias] = itemMeta
			}
		}
	}

	if len(metadata) == 0 {
		return nil
	}

	return metadata
}

func (sr *SecretRedactor) buildMCPItemMetadata(item models.MCPIntegrationConfig, fieldConfigs []encryption.FieldConfig) *models.ArrayItemSecretMetadata {
	meta := &models.ArrayItemSecretMetadata{}
	hasSecrets := false

	for _, fc := range fieldConfigs {
		switch fc.Path {
		case "headers":
			if len(item.Headers) > 0 {
				meta.Headers = true
				hasSecrets = true
			}
		case "env":
			if len(item.Env) > 0 {
				meta.Env = true
				hasSecrets = true
			}
		}
	}

	if !hasSecrets {
		return nil
	}
	return meta
}

func (sr *SecretRedactor) buildRPCItemMetadata(item models.RPCIntegrationConfig, fieldConfigs []encryption.FieldConfig) *models.ArrayItemSecretMetadata {
	meta := &models.ArrayItemSecretMetadata{}
	hasSecrets := false

	for _, fc := range fieldConfigs {
		switch fc.Path {
		case "privateKey":
			if item.PrivateKey != "" {
				meta.PrivateKey = true
				hasSecrets = true
			}
		case "passphrase":
			if item.Passphrase != "" {
				meta.Passphrase = true
				hasSecrets = true
			}
		case "headers":
			if len(item.Headers) > 0 {
				meta.Headers = true
				hasSecrets = true
			}
		case "env":
			if len(item.Env) > 0 {
				meta.Env = true
				hasSecrets = true
			}
		}
	}

	if !hasSecrets {
		return nil
	}
	return meta
}

func (sr *SecretRedactor) RedactSecretsFromIntegration(integration *models.Integration) {
	if integration.OpenAI != nil {
		integration.OpenAI.APIKey = ""
	}
	if integration.Yandex != nil {
		integration.Yandex.APIKey = ""
	}
	if integration.Claude != nil {
		integration.Claude.APIKey = ""
	}
	if integration.Qwen != nil {
		integration.Qwen.APIKey = ""
	}
	if integration.Deepseek != nil {
		integration.Deepseek.APIKey = ""
	}
	if integration.CustomLLM != nil {
		integration.CustomLLM.APIKey = ""
	}
	if integration.Perplexity != nil {
		integration.Perplexity.APIKey = ""
	}

	for i := range integration.RPC {
		if integration.RPC[i].PrivateKey != "" {
			integration.RPC[i].PrivateKey = SecretRedactionSentinel
		}
		if integration.RPC[i].Passphrase != "" {
			integration.RPC[i].Passphrase = SecretRedactionSentinel
		}
	}
}
