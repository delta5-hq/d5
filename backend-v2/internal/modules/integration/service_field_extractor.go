package integration

import (
	"backend-v2/internal/models"
	"encoding/json"
	"fmt"
)

type ServiceFieldExtractor struct {
	secretRedactor   *SecretRedactor
	metadataAccessor metadataFieldAccessor
}

func NewServiceFieldExtractor(secretRedactor *SecretRedactor) *ServiceFieldExtractor {
	return &ServiceFieldExtractor{
		secretRedactor:   secretRedactor,
		metadataAccessor: newMetadataFieldAccessor(),
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

	if metaWrapper := e.metadataAccessor.extractMetadataForField(metadata, fieldName); metaWrapper != nil {
		response["secretsMeta"] = metaWrapper
	}

	return response, nil
}
