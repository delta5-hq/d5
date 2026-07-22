package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	customLLMValidationTimeout = 5 * time.Second
	customLLMChatEndpoint      = "/chat/completions"
	customLLMDefaultModel      = "gpt-4o-mini"
	customLLMProbePrompt       = "Hello!"
	customLLMErrorPreviewLimit = 300
	customLLMContentTypeHeader = "Content-Type"
	customLLMAuthorization     = "Authorization"
	customLLMJSONContentType   = "application/json"
	customLLMBearerPrefix      = "Bearer "
	customLLMOpenAICompatible  = "OpenAI compatible"
	customLLMOpenAIReasoning   = "OpenAI compatible Chain-of-Thought"
)

type customLLMHTTPClient interface {
	Do(*http.Request) (*http.Response, error)
}

type customLLMValidationProfile struct {
	chatEndpoint string
	buildBody    func(map[string]interface{}) ([]byte, error)
	validateBody func(io.Reader) error
}

type CustomLLMValidator struct {
	client customLLMHTTPClient
}

var openAICompatibleValidationProfile = customLLMValidationProfile{
	chatEndpoint: customLLMChatEndpoint,
	buildBody:    buildOpenAICompatibleValidationBody,
	validateBody: validateOpenAICompatibleValidationResponse,
}

var customLLMValidationProfiles = map[string]customLLMValidationProfile{
	customLLMOpenAICompatible: openAICompatibleValidationProfile,
	customLLMOpenAIReasoning:  openAICompatibleValidationProfile,
	"":                        openAICompatibleValidationProfile,
}

var customLLMAPITypeAliases = map[string]string{
	"openai":                             customLLMOpenAICompatible,
	"openai_compatible":                  customLLMOpenAICompatible,
	"openaiCompatible":                   customLLMOpenAICompatible,
	"openai_compatible_chain_of_thought": customLLMOpenAIReasoning,
}

func NewCustomLLMValidator() *CustomLLMValidator {
	return &CustomLLMValidator{client: &http.Client{Timeout: customLLMValidationTimeout}}
}

func (v *CustomLLMValidator) Validate(ctx context.Context, config map[string]interface{}) error {
	apiRootURL, ok := customLLMNonBlankString(config["apiRootUrl"])
	if !ok {
		return nil
	}

	profile, err := resolveCustomLLMValidationProfile(config)
	if err != nil {
		return err
	}

	requestBody, err := profile.buildBody(config)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		joinCustomLLMURL(apiRootURL, profile.chatEndpoint),
		bytes.NewReader(requestBody),
	)
	if err != nil {
		return fmt.Errorf("custom LLM endpoint is invalid: %w", err)
	}
	req.Header.Set(customLLMContentTypeHeader, customLLMJSONContentType)
	if apiKey, ok := customLLMNonBlankString(config["apiKey"]); ok {
		req.Header.Set(customLLMAuthorization, customLLMBearerPrefix+apiKey)
	}

	resp, err := v.client.Do(req)
	if err != nil {
		return fmt.Errorf("custom LLM endpoint is unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf(
			"custom LLM endpoint validation failed with status %d%s",
			resp.StatusCode,
			readCustomLLMErrorPreview(resp.Body),
		)
	}

	if err := profile.validateBody(resp.Body); err != nil {
		return fmt.Errorf("custom LLM endpoint returned an invalid OpenAI-compatible response: %w", err)
	}

	return nil
}

func resolveCustomLLMValidationProfile(config map[string]interface{}) (customLLMValidationProfile, error) {
	apiType, _ := customLLMNonBlankString(config["apiType"])
	apiType = normalizeCustomLLMAPIType(apiType)
	profile, ok := customLLMValidationProfiles[apiType]
	if !ok {
		return customLLMValidationProfile{}, fmt.Errorf(
			"custom LLM apiType %q is not supported for endpoint validation",
			apiType,
		)
	}
	return profile, nil
}

func normalizeCustomLLMAPIType(apiType string) string {
	if alias, ok := customLLMAPITypeAliases[apiType]; ok {
		return alias
	}
	return apiType
}

func buildOpenAICompatibleValidationBody(config map[string]interface{}) ([]byte, error) {
	model, ok := customLLMNonBlankString(config["model"])
	if !ok {
		model = customLLMDefaultModel
	}

	body := map[string]interface{}{
		"model":      model,
		"messages":   []map[string]string{{"role": "user", "content": customLLMProbePrompt}},
		"max_tokens": 10,
	}

	return json.Marshal(body)
}

func validateOpenAICompatibleValidationResponse(reader io.Reader) error {
	var body struct {
		Choices []struct {
			Message map[string]interface{} `json:"message"`
			Text    string                 `json:"text"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(reader).Decode(&body); err != nil {
		return err
	}
	if len(body.Choices) == 0 {
		return fmt.Errorf("missing choices")
	}

	for _, choice := range body.Choices {
		if len(choice.Message) > 0 || strings.TrimSpace(choice.Text) != "" {
			return nil
		}
	}

	return fmt.Errorf("missing choice content")
}

func joinCustomLLMURL(apiRootURL string, endpoint string) string {
	return strings.TrimRight(apiRootURL, "/") + endpoint
}

func customLLMNonBlankString(value interface{}) (string, bool) {
	text, ok := value.(string)
	if !ok {
		return "", false
	}
	text = strings.TrimSpace(text)
	return text, text != ""
}

func readCustomLLMErrorPreview(reader io.Reader) string {
	body, err := io.ReadAll(io.LimitReader(reader, customLLMErrorPreviewLimit+1))
	if err != nil {
		return ""
	}
	truncated := len(body) > customLLMErrorPreviewLimit
	text := strings.TrimSpace(strings.Join(strings.Fields(string(body)), " "))
	if text == "" {
		return ""
	}
	if len(text) > customLLMErrorPreviewLimit {
		text = text[:customLLMErrorPreviewLimit] + "…"
	} else if truncated {
		text += "…"
	}
	return ": " + text
}

type noopCustomLLMHTTPClient struct{}

func (c *noopCustomLLMHTTPClient) Do(*http.Request) (*http.Response, error) {
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"ok"}}]}`)),
	}, nil
}

func newCustomLLMValidatorForMode(mock bool) *CustomLLMValidator {
	if mock {
		return &CustomLLMValidator{client: &noopCustomLLMHTTPClient{}}
	}
	return NewCustomLLMValidator()
}
