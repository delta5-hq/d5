package integration

import (
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

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
	if c.hasAnyLLMFields(doc) {
		return false
	}
	for fieldName := range registeredArrayFields {
		if c.hasArrayItems(doc, fieldName) {
			return false
		}
	}
	return true
}

// Merged with a scope filter it forms an atomic conditional-remove predicate:
// the document is only deleted when it is empty, preventing a concurrent add from
// racing past the emptiness check and removing a non-empty document.
func (c *DocumentEmptinessChecker) MongoEmptyConditions() bson.M {
	conditions := bson.M{}
	for fieldName := range registeredArrayFields {
		conditions[fieldName+".0"] = bson.M{"$exists": false}
	}
	for _, llmField := range c.llmFieldNames {
		conditions[llmField] = nil
	}
	return conditions
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
