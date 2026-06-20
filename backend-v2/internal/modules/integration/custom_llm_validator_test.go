package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCustomLLMValidatorSuccessfulProbeRequest(t *testing.T) {
	tests := []struct {
		name              string
		config            map[string]interface{}
		wantAuthorization string
		wantModel         string
	}{
		{
			name: "explicit OpenAI-compatible profile with credentials and model",
			config: map[string]interface{}{
				"apiKey":  "sk-test",
				"model":   "custom-model",
				"apiType": customLLMOpenAICompatible,
			},
			wantAuthorization: customLLMBearerPrefix + "sk-test",
			wantModel:         "custom-model",
		},
		{
			name:              "legacy empty profile defaults model and omits authorization",
			config:            map[string]interface{}{},
			wantAuthorization: "",
			wantModel:         customLLMDefaultModel,
		},
		{
			name:              "reasoning OpenAI-compatible profile uses same chat-completions contract",
			config:            map[string]interface{}{"apiType": customLLMOpenAIReasoning},
			wantAuthorization: "",
			wantModel:         customLLMDefaultModel,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assertCustomLLMProbeRequest(t, r, tt.wantAuthorization, tt.wantModel)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
			}))
			defer server.Close()

			validator := NewCustomLLMValidator()
			config := cloneConfig(tt.config)
			config["apiRootUrl"] = server.URL + "/"

			err := validator.Validate(context.Background(), config)

			if err != nil {
				t.Fatalf("Validate returned error: %v", err)
			}
		})
	}
}

func TestCustomLLMValidatorRejectsMalformedSuccessResponse(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "non JSON", body: "ok"},
		{name: "missing choices", body: `{}`},
		{name: "empty choices", body: `{"choices":[]}`},
		{name: "empty choice content", body: `{"choices":[{}]}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			validator := NewCustomLLMValidator()
			err := validator.Validate(context.Background(), map[string]interface{}{"apiRootUrl": server.URL})

			if err == nil || !strings.Contains(err.Error(), "invalid OpenAI-compatible response") {
				t.Fatalf("error = %v", err)
			}
		})
	}
}

func TestCustomLLMValidatorSupportedProfilesUseOpenAICompatibleContract(t *testing.T) {
	for _, tt := range supportedCustomLLMProfileCases() {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assertCustomLLMProbeRequest(t, r, "", customLLMDefaultModel)
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
			}))
			defer server.Close()

			validator := NewCustomLLMValidator()
			err := validator.Validate(context.Background(), map[string]interface{}{
				"apiRootUrl": server.URL + "////",
				"apiType":    tt.apiType,
			})

			if err != nil {
				t.Fatalf("Validate returned error: %v", err)
			}
		})
	}
}

type customLLMProfileCase struct {
	name    string
	apiType string
}

func supportedCustomLLMProfileCases() []customLLMProfileCase {
	cases := make([]customLLMProfileCase, 0, len(customLLMValidationProfiles)+len(customLLMAPITypeAliases))

	for apiType := range customLLMValidationProfiles {
		name := "registered profile"
		if apiType != "" {
			name += " " + apiType
		} else {
			name += " default"
		}
		cases = append(cases, customLLMProfileCase{name: name, apiType: apiType})
	}

	for alias := range customLLMAPITypeAliases {
		cases = append(cases, customLLMProfileCase{name: "legacy alias " + alias, apiType: alias})
	}

	return cases
}

func TestCustomLLMValidatorStopsBeforeNetworkForUnsupportedProfile(t *testing.T) {
	client := &countingCustomLLMClient{}
	validator := NewCustomLLMValidator()
	validator.client = client

	err := validator.Validate(context.Background(), map[string]interface{}{
		"apiRootUrl": "https://llm.example",
		"apiType":    "unsupported",
	})

	if err == nil || !strings.Contains(err.Error(), "apiType") {
		t.Fatalf("error = %v", err)
	}
	if client.calls != 0 {
		t.Fatalf("network calls = %d, want 0", client.calls)
	}
}

func TestOpenAICompatibleValidationResponseShape(t *testing.T) {
	tests := []struct {
		name    string
		body    string
		wantErr string
	}{
		{name: "chat message content", body: `{"choices":[{"message":{"content":"ok"}}]}`},
		{name: "legacy text content", body: `{"choices":[{"text":"ok"}]}`},
		{name: "multiple choices with one populated", body: `{"choices":[{}, {"text":"ok"}]}`},
		{name: "non JSON", body: `ok`, wantErr: "invalid character"},
		{name: "missing choices", body: `{}`, wantErr: "missing choices"},
		{name: "empty choices", body: `{"choices":[]}`, wantErr: "missing choices"},
		{name: "empty choice content", body: `{"choices":[{}]}`, wantErr: "missing choice content"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOpenAICompatibleValidationResponse(strings.NewReader(tt.body))

			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate returned error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v", err)
			}
		})
	}
}

func TestJoinCustomLLMURL(t *testing.T) {
	tests := []struct {
		name     string
		root     string
		endpoint string
		want     string
	}{
		{name: "root without slash", root: "https://llm.example/v1", endpoint: "/chat/completions", want: "https://llm.example/v1/chat/completions"},
		{name: "root with one slash", root: "https://llm.example/v1/", endpoint: "/chat/completions", want: "https://llm.example/v1/chat/completions"},
		{name: "root with repeated slashes", root: "https://llm.example/v1///", endpoint: "/chat/completions", want: "https://llm.example/v1/chat/completions"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := joinCustomLLMURL(tt.root, tt.endpoint); got != tt.want {
				t.Fatalf("joinCustomLLMURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

type countingCustomLLMClient struct {
	calls int
}

func (c *countingCustomLLMClient) Do(*http.Request) (*http.Response, error) {
	c.calls++
	return nil, nil
}

func TestCustomLLMValidatorEndpointFailureMessages(t *testing.T) {
	tests := []struct {
		name          string
		status        int
		body          string
		wantSubstring string
		wantSuffix    string
	}{
		{
			name:          "non-success status includes compact body preview",
			status:        http.StatusBadGateway,
			body:          " upstream\nfailed ",
			wantSubstring: "status 502: upstream failed",
		},
		{
			name:          "long error body is compacted and truncated",
			status:        http.StatusBadRequest,
			body:          " first\nsecond " + strings.Repeat("x", customLLMErrorPreviewLimit+20),
			wantSubstring: "status 400: first second",
			wantSuffix:    "…",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			}))
			defer server.Close()

			validator := NewCustomLLMValidator()
			err := validator.Validate(context.Background(), map[string]interface{}{"apiRootUrl": server.URL})

			if err == nil {
				t.Fatalf("expected validation error")
			}
			if !strings.Contains(err.Error(), tt.wantSubstring) {
				t.Fatalf("error = %v", err)
			}
			if tt.wantSuffix != "" && !strings.HasSuffix(err.Error(), tt.wantSuffix) {
				t.Fatalf("expected error suffix %q, got %v", tt.wantSuffix, err)
			}
		})
	}
}

func TestCustomLLMValidatorRejectsUnreachableEndpoint(t *testing.T) {
	validator := NewCustomLLMValidator()
	err := validator.Validate(context.Background(), map[string]interface{}{"apiRootUrl": "http://127.0.0.1:1"})

	if err == nil || !strings.Contains(err.Error(), "custom LLM endpoint is unreachable") {
		t.Fatalf("error = %v", err)
	}
}

func TestCustomLLMValidatorSkipsEmptyEndpoint(t *testing.T) {
	validator := NewCustomLLMValidator()
	err := validator.Validate(context.Background(), map[string]interface{}{"apiRootUrl": "   "})

	if err != nil {
		t.Fatalf("Validate returned error: %v", err)
	}
}

func assertCustomLLMProbeRequest(t *testing.T, r *http.Request, wantAuthorization string, wantModel string) {
	t.Helper()

	if r.URL.Path != customLLMChatEndpoint {
		t.Fatalf("path = %q, want %q", r.URL.Path, customLLMChatEndpoint)
	}
	if r.Header.Get(customLLMAuthorization) != wantAuthorization {
		t.Fatalf("Authorization = %q, want %q", r.Header.Get(customLLMAuthorization), wantAuthorization)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["model"] != wantModel {
		t.Fatalf("model = %v, want %v", body["model"], wantModel)
	}
	if _, exists := body["url"]; exists {
		t.Fatalf("validation body leaked url field")
	}
}

func cloneConfig(config map[string]interface{}) map[string]interface{} {
	clone := make(map[string]interface{}, len(config)+1)
	for key, value := range config {
		clone[key] = value
	}
	return clone
}

func TestNoopCustomLLMHTTPClientResponsePassesValidationPipeline(t *testing.T) {
	client := &noopCustomLLMHTTPClient{}
	req, err := http.NewRequest(http.MethodPost, "http://irrelevant", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	resp, err := client.Do(req)

	if err != nil {
		t.Fatalf("noop client returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if err := validateOpenAICompatibleValidationResponse(resp.Body); err != nil {
		t.Fatalf("noop response body failed validation pipeline: %v", err)
	}
}

func TestNewCustomLLMValidatorForModeMockSkipsNetwork(t *testing.T) {
	validator := newCustomLLMValidatorForMode(true)

	err := validator.Validate(context.Background(), map[string]interface{}{
		"apiRootUrl": "http://127.0.0.1:1",
	})

	if err != nil {
		t.Fatalf("mock-mode validator must not make network calls, got: %v", err)
	}
}

func TestNewCustomLLMValidatorForModeProdMatchesDirectConstructor(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()

	config := map[string]interface{}{"apiRootUrl": server.URL}

	errDirect := NewCustomLLMValidator().Validate(context.Background(), config)
	errFactory := newCustomLLMValidatorForMode(false).Validate(context.Background(), config)

	if errDirect != nil {
		t.Fatalf("direct constructor failed: %v", errDirect)
	}
	if errFactory != nil {
		t.Fatalf("prod-mode factory failed: %v", errFactory)
	}
}

func TestNewCustomLLMValidatorForModeMockPassesAllSupportedAPITypes(t *testing.T) {
	validator := newCustomLLMValidatorForMode(true)

	for _, tc := range supportedCustomLLMProfileCases() {
		t.Run(tc.name, func(t *testing.T) {
			err := validator.Validate(context.Background(), map[string]interface{}{
				"apiRootUrl": "https://unreachable.example.com",
				"apiType":    tc.apiType,
			})
			if err != nil {
				t.Fatalf("mock validator returned error for apiType=%q: %v", tc.apiType, err)
			}
		})
	}
}

func TestNewCustomLLMValidatorForModeMockPreservesNonNetworkValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  map[string]interface{}
		wantErr string
	}{
		{
			name:    "unsupported api type is still rejected before client call",
			config:  map[string]interface{}{"apiRootUrl": "https://unreachable.example.com", "apiType": "unsupported"},
			wantErr: "apiType",
		},
		{
			name:    "malformed endpoint is still rejected before client call",
			config:  map[string]interface{}{"apiRootUrl": "://not-a-url"},
			wantErr: "endpoint is invalid",
		},
		{
			name:   "empty endpoint remains a no-op",
			config: map[string]interface{}{"apiRootUrl": "   ", "apiType": "unsupported"},
		},
	}

	validator := newCustomLLMValidatorForMode(true)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validator.Validate(context.Background(), tt.config)

			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate returned error: %v", err)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("error = %v, want substring %q", err, tt.wantErr)
			}
		})
	}
}
