package integration

import "go.mongodb.org/mongo-driver/bson/primitive"

type DocumentEmptinessChecker struct {
	llmFieldNames []string
}

func NewDocumentEmptinessChecker() *DocumentEmptinessChecker {
	return &DocumentEmptinessChecker{
		llmFieldNames: []string{
			"openai",
			"yandex",
			"claude",
			"qwen",
			"deepseek",
			"custom_llm",
			"perplexity",
		},
	}
}

func (c *DocumentEmptinessChecker) IsEmpty(doc map[string]interface{}) bool {
	return !c.hasAnyLLMFields(doc) && !c.hasArrayItems(doc, "mcp") && !c.hasArrayItems(doc, "rpc")
}

func (c *DocumentEmptinessChecker) hasAnyLLMFields(doc map[string]interface{}) bool {
	for _, fieldName := range c.llmFieldNames {
		if val, exists := doc[fieldName]; exists && val != nil {
			return true
		}
	}
	return false
}

func (c *DocumentEmptinessChecker) hasArrayItems(doc map[string]interface{}, fieldName string) bool {
	val, exists := doc[fieldName]
	if !exists {
		return false
	}

	switch v := val.(type) {
	case []interface{}:
		return len(v) > 0
	case primitive.A:
		return len(v) > 0
	default:
		return false
	}
}
