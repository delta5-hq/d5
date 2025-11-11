package openai

import (
	"context"
	"fmt"
	"os"

	"github.com/sashabaranov/go-openai"
)

type prodService struct {
	client *openai.Client
	apiKey string
}

func NewProdService() Service {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return &noopService{}
	}

	return &prodService{
		client: openai.NewClient(apiKey),
		apiKey: apiKey,
	}
}

func (s *prodService) ChatCompletions(messages []ChatMessage, model string, params map[string]interface{}) (*ChatCompletionResponse, error) {
	if model == "" {
		model = openai.GPT3Dot5Turbo
	}

	req := openai.ChatCompletionRequest{
		Model:    model,
		Messages: make([]openai.ChatCompletionMessage, len(messages)),
	}

	for i, msg := range messages {
		req.Messages[i] = openai.ChatCompletionMessage{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}

	resp, err := s.client.CreateChatCompletion(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI chat completion failed: %w", err)
	}

	response := &ChatCompletionResponse{
		ID:      resp.ID,
		Object:  resp.Object,
		Created: resp.Created,
		Model:   resp.Model,
		Choices: make([]struct {
			Index   int         `json:"index"`
			Message ChatMessage `json:"message"`
		}, len(resp.Choices)),
	}

	for i, choice := range resp.Choices {
		response.Choices[i] = struct {
			Index   int         `json:"index"`
			Message ChatMessage `json:"message"`
		}{
			Index: choice.Index,
			Message: ChatMessage{
				Role:    choice.Message.Role,
				Content: choice.Message.Content,
			},
		}
	}

	return response, nil
}

func (s *prodService) Embeddings(input []string, model string) (*EmbeddingResponse, error) {
	if model == "" {
		model = string(openai.AdaEmbeddingV2)
	}

	req := openai.EmbeddingRequest{
		Input: input,
		Model: openai.EmbeddingModel(model),
	}

	resp, err := s.client.CreateEmbeddings(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("OpenAI embeddings failed: %w", err)
	}

	response := &EmbeddingResponse{
		Data: make([]struct {
			Index     int       `json:"index"`
			Object    string    `json:"object"`
			Embedding []float64 `json:"embedding"`
		}, len(resp.Data)),
	}

	for i, emb := range resp.Data {
		/* Convert []float32 to []float64 */
		embedding64 := make([]float64, len(emb.Embedding))
		for j, v := range emb.Embedding {
			embedding64[j] = float64(v)
		}

		response.Data[i] = struct {
			Index     int       `json:"index"`
			Object    string    `json:"object"`
			Embedding []float64 `json:"embedding"`
		}{
			Index:     emb.Index,
			Object:    emb.Object,
			Embedding: embedding64,
		}
	}

	return response, nil
}

func (s *prodService) DalleGenerations(prompt string, n int, size string, responseFormat string) (*ImageGenerationResponse, error) {
	if size == "" {
		size = openai.CreateImageSize1024x1024
	}
	if responseFormat == "" {
		responseFormat = openai.CreateImageResponseFormatURL
	}

	req := openai.ImageRequest{
		Prompt:         prompt,
		N:              n,
		Size:           size,
		ResponseFormat: responseFormat,
	}

	resp, err := s.client.CreateImage(context.Background(), req)
	if err != nil {
		return nil, fmt.Errorf("DALL-E generation failed: %w", err)
	}

	response := &ImageGenerationResponse{
		Created: resp.Created,
		Data: make([]struct {
			URL string `json:"url"`
		}, len(resp.Data)),
	}

	for i, img := range resp.Data {
		response.Data[i] = struct {
			URL string `json:"url"`
		}{
			URL: img.URL,
		}
	}

	return response, nil
}

func (s *prodService) CheckApiKey() bool {
	return s.apiKey != ""
}
