package main

import (
	"context"
	"fmt"
	"os"

	"backend-v2/internal/modules/integration"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type llmProviderConfig struct {
	openaiAPIKey        string
	claudeAPIKey        string
	deepseekAPIKey      string
	qwenAPIKey          string
	customLLMAPIRootURL string
	customLLMAPIKey     string
}

func llmProviderConfigFromEnv() llmProviderConfig {
	return llmProviderConfig{
		openaiAPIKey:        os.Getenv("SEED_OPENAI_API_KEY"),
		claudeAPIKey:        os.Getenv("SEED_CLAUDE_API_KEY"),
		deepseekAPIKey:      os.Getenv("SEED_DEEPSEEK_API_KEY"),
		qwenAPIKey:          os.Getenv("SEED_QWEN_API_KEY"),
		customLLMAPIRootURL: os.Getenv("SEED_CUSTOM_LLM_API_ROOT_URL"),
		customLLMAPIKey:     os.Getenv("SEED_CUSTOM_LLM_API_KEY"),
	}
}

func (c llmProviderConfig) hasAnyProvider() bool {
	return c.openaiAPIKey != "" ||
		c.claudeAPIKey != "" ||
		c.deepseekAPIKey != "" ||
		c.qwenAPIKey != "" ||
		c.customLLMAPIRootURL != ""
}

func (c llmProviderConfig) buildRawDocument(userID string) map[string]interface{} {
	doc := map[string]interface{}{
		"userId":     userID,
		"workflowId": nil,
		"lang":       "none",
		"model":      "auto",
		"mcp":        []interface{}{},
		"rpc":        []interface{}{},
	}

	if c.openaiAPIKey != "" {
		doc["openai"] = map[string]interface{}{
			"apiKey": c.openaiAPIKey,
			"model":  "gpt-4.1-mini",
		}
	}
	if c.claudeAPIKey != "" {
		doc["claude"] = map[string]interface{}{
			"apiKey": c.claudeAPIKey,
			"model":  "claude-sonnet-4-6",
		}
	}
	if c.deepseekAPIKey != "" {
		doc["deepseek"] = map[string]interface{}{
			"apiKey": c.deepseekAPIKey,
		}
	}
	if c.qwenAPIKey != "" {
		doc["qwen"] = map[string]interface{}{
			"apiKey": c.qwenAPIKey,
		}
	}
	if c.customLLMAPIRootURL != "" {
		custom := map[string]interface{}{
			"apiRootUrl":          c.customLLMAPIRootURL,
			"maxTokens":           15000,
			"embeddingsChunkSize": 2048,
			"apiType":             "OpenAI compatible",
		}
		if c.customLLMAPIKey != "" {
			custom["apiKey"] = c.customLLMAPIKey
		}
		doc["custom_llm"] = custom
	}

	return doc
}

func seedAdminIntegration(ctx context.Context, db *mongo.Database, userID string) error {
	cfg := llmProviderConfigFromEnv()
	if !cfg.hasAnyProvider() {
		return nil
	}

	encryptor, err := integration.NewDocumentEncryptor()
	if err != nil {
		return fmt.Errorf("create encryptor: %w", err)
	}

	doc := cfg.buildRawDocument(userID)

	if err := encryptor.Encrypt(doc, userID, nil); err != nil {
		return fmt.Errorf("encrypt integration document: %w", err)
	}

	coll := db.Collection("integrations")
	filter := bson.M{"userId": userID, "workflowId": nil}
	update := bson.M{"$set": doc}
	upsertOpt := options.Update().SetUpsert(true)

	if _, err := coll.UpdateOne(ctx, filter, update, upsertOpt); err != nil {
		return fmt.Errorf("upsert integration document: %w", err)
	}

	return nil
}
