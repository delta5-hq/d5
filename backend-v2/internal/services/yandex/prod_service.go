package yandex

import (
	"backend-v2/internal/models"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

/* YandexOperationTimeoutError indicates operation polling timed out */
type YandexOperationTimeoutError struct {
	message string
}

func (e *YandexOperationTimeoutError) Error() string {
	return e.message
}

type operationResponse struct {
	ID       string                 `json:"id"`
	Done     bool                   `json:"done"`
	Response *CompletionResponse    `json:"response,omitempty"`
	Error    *operationError        `json:"error,omitempty"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

type operationError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type prodService struct {
	client *http.Client
}

func NewProdService() Service {
	return &prodService{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

/* Completion sends completion request - fetches apiKey + folder_id from Integration DB by userId */
func (s *prodService) Completion(db *qmgo.Database, userId string, messages []Message, model string, params map[string]interface{}) (*CompletionResponse, error) {
	var integration models.Integration
	err := db.Collection("integrations").Find(context.Background(), bson.M{"userId": userId}).One(&integration)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Yandex == nil || integration.Yandex.APIKey == "" {
		return nil, errors.New("yandex API key not configured")
	}

	apiKey := integration.Yandex.APIKey
	folderId := integration.Yandex.FolderID

	if folderId == "" {
		return nil, errors.New("yandex folder_id not configured")
	}

	if model == "" && integration.Yandex.Model != "" {
		model = integration.Yandex.Model
	}

	retryCount := 0
	if params != nil {
		if r, ok := params["retry"].(int); ok && r > 0 {
			retryCount = r
		}
	}

	if retryCount > 0 {
		return s.completionWithRetry(apiKey, folderId, model, messages, params, retryCount)
	}

	operation, err := s.createCompletionOperation(apiKey, folderId, model, messages, params)
	if err != nil {
		return nil, err
	}

	return s.getOperationResult(operation, apiKey, 60)
}

/* createCompletionOperation calls async completion API and returns operation ID */
func (s *prodService) createCompletionOperation(apiKey, folderId, model string, messages []Message, params map[string]interface{}) (*operationResponse, error) {
	requestBody := map[string]interface{}{
		"modelUri": fmt.Sprintf("gpt://%s/%s", folderId, model),
		"completionOptions": map[string]interface{}{
			"stream":      false,
			"temperature": 0.2,
			"maxTokens":   2000,
		},
		"messages": messages,
	}

	if opts, ok := requestBody["completionOptions"].(map[string]interface{}); ok {
		for key, value := range params {
			if key != "retry" {
				opts[key] = value
			}
		}
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://llm.api.cloud.yandex.net/foundationModels/v1/completionAsync", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Api-Key "+apiKey)
	req.Header.Set("x-folder-id", folderId)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yandex completionAsync API returned status %d", resp.StatusCode)
	}

	var operation operationResponse
	if err := json.NewDecoder(resp.Body).Decode(&operation); err != nil {
		return nil, fmt.Errorf("failed to decode operation response: %w", err)
	}

	return &operation, nil
}

/* getOperationResult polls operation status until done or maxAttempts reached */
func (s *prodService) getOperationResult(operation *operationResponse, apiKey string, maxAttempts int) (*CompletionResponse, error) {
	attempts := 0
	operationStatus := operation

	for !operationStatus.Done && attempts < maxAttempts {
		req, err := http.NewRequest("GET", fmt.Sprintf("https://operation.api.cloud.yandex.net/operations/%s", operation.ID), nil)
		if err != nil {
			return nil, fmt.Errorf("failed to create status request: %w", err)
		}

		req.Header.Set("Authorization", "Api-Key "+apiKey)

		resp, err := s.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to check operation status: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("operation status API returned status %d", resp.StatusCode)
		}

		if err := json.NewDecoder(resp.Body).Decode(&operationStatus); err != nil {
			resp.Body.Close()
			return nil, fmt.Errorf("failed to decode status response: %w", err)
		}
		resp.Body.Close()

		time.Sleep(1 * time.Second)
		attempts++
	}

	if attempts == maxAttempts {
		return nil, &YandexOperationTimeoutError{message: "YandexGPT request timeout"}
	}

	if operationStatus.Error != nil {
		return nil, fmt.Errorf("yandex operation error: %s", operationStatus.Error.Message)
	}

	return operationStatus.Response, nil
}

/* completionWithRetry implements retry mechanism with dynamic timeout management */
func (s *prodService) completionWithRetry(apiKey, folderId, model string, messages []Message, params map[string]interface{}, retries int) (*CompletionResponse, error) {
	attempts := retries + 1
	timeoutManager := NewDynamicTimeoutManager()

	var result *CompletionResponse

	for attempts > 0 && result == nil {
		attempts--

		operation, err := s.createCompletionOperation(apiKey, folderId, model, messages, params)
		if err != nil {
			if attempts == 0 {
				return nil, err
			}
			continue
		}

		startTime := time.Now()
		timeout := timeoutManager.CalculateTimeout(attempts)

		result, err = s.getOperationResult(operation, apiKey, timeout)

		duration := time.Since(startTime).Seconds()
		timeoutManager.UpdateDuration(duration)

		if err != nil {
			/* Only retry on timeout if attempts remain */
			if _, isTimeout := err.(*YandexOperationTimeoutError); isTimeout && attempts > 0 {
				result = nil
				continue
			}
			return nil, err
		}
	}

	if result == nil {
		return nil, errors.New("Can not get response from yandexgpt")
	}

	return result, nil
}

func (s *prodService) Embeddings(db *qmgo.Database, userId string, text string, modelUri string) (*EmbeddingResponse, error) {
	var integration models.Integration
	err := db.Collection("integrations").Find(context.Background(), bson.M{"userId": userId}).One(&integration)
	if err != nil {
		return nil, fmt.Errorf("integration not found for user: %w", err)
	}

	if integration.Yandex == nil || integration.Yandex.APIKey == "" {
		return nil, errors.New("yandex API key not configured")
	}

	apiKey := integration.Yandex.APIKey
	folderId := integration.Yandex.FolderID

	if folderId == "" {
		return nil, errors.New("yandex folder ID not configured")
	}

	effectiveModelUri := modelUri
	if effectiveModelUri == "" && integration.Yandex.Model != "" {
		effectiveModelUri = fmt.Sprintf("emb://%s/%s", folderId, integration.Yandex.Model)
	}

	requestBody := map[string]interface{}{
		"modelUri": effectiveModelUri,
		"text":     text,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://llm.api.cloud.yandex.net/foundationModels/v1/textEmbedding", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Api-Key "+apiKey)
	req.Header.Set("x-folder-id", folderId)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yandex API returned status %d", resp.StatusCode)
	}

	var result EmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}
