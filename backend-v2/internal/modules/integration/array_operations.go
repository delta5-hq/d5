package integration

import (
	"context"
	"fmt"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

func (s *Service) AddArrayItem(ctx context.Context, scope ScopeIdentifier, fieldName string, item map[string]interface{}) error {
	alias, ok := item["alias"].(string)
	if !ok || alias == "" {
		return fmt.Errorf("alias is required")
	}

	if err := s.validateArrayItemDoesNotExist(ctx, scope, fieldName, alias); err != nil {
		return err
	}

	if err := validateNoSentinelSecrets(fieldName, item); err != nil {
		return err
	}

	encryptedItem, err := s.encryptArrayItem(scope, fieldName, item)
	if err != nil {
		return err
	}

	filter := buildScopeFilter(scope)
	update := bson.M{"$push": bson.M{fieldName: encryptedItem}}

	var existing map[string]interface{}
	err = s.collection.Find(ctx, filter).One(&existing)

	if err == qmgo.ErrNoSuchDocuments {
		newDoc := bson.M{
			"userId":     scope.UserID,
			"workflowId": scope.WorkflowID,
			"lang":       defaultLanguage,
			"model":      defaultModel,
			fieldName:    []interface{}{encryptedItem},
		}
		_, insertErr := s.collection.InsertOne(ctx, newDoc)
		return insertErr
	}

	if err != nil {
		return err
	}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) encryptArrayItem(scope ScopeIdentifier, arrayName string, item map[string]interface{}) (map[string]interface{}, error) {
	tempDoc := map[string]interface{}{
		arrayName: []interface{}{item},
	}

	if err := s.encryptor.Encrypt(tempDoc, scope.UserID, scope.WorkflowID); err != nil {
		return nil, err
	}

	encryptedArray, ok := tempDoc[arrayName].([]interface{})
	if !ok || len(encryptedArray) == 0 {
		return item, nil
	}

	encryptedItem, ok := encryptedArray[0].(map[string]interface{})
	if !ok {
		return item, nil
	}

	return encryptedItem, nil
}

func (s *Service) UpdateArrayItem(ctx context.Context, scope ScopeIdentifier, fieldName, alias string, updates map[string]interface{}) error {
	if err := s.validateArrayItemExists(ctx, scope, fieldName, alias); err != nil {
		return err
	}

	filter := bson.M{
		"userId":             scope.UserID,
		"workflowId":         scope.WorkflowID,
		fieldName + ".alias": alias,
	}

	setFields := bson.M{}
	for key, value := range updates {
		if key == "alias" {
			continue
		}

		if isEncryptedField(fieldName, key) {
			if isSentinelValue(value) || isSentinelMap(value) {
				continue
			}
		}

		encryptedValue, err := s.fieldCrypto.EncryptArrayFieldUpdate(scope, fieldName, alias, key, value)
		if err != nil {
			return err
		}
		setFields[fieldName+".$."+key] = encryptedValue
	}

	update := bson.M{"$set": setFields}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) DeleteArrayItem(ctx context.Context, scope ScopeIdentifier, fieldName, alias string) error {
	filter := buildScopeFilter(scope)
	update := bson.M{
		"$pull": bson.M{
			fieldName: bson.M{"alias": alias},
		},
	}

	err := s.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return nil
		}
		return err
	}

	var updated map[string]interface{}
	readErr := s.collection.Find(ctx, filter).One(&updated)
	if readErr != nil && readErr != qmgo.ErrNoSuchDocuments {
		return readErr
	}

	if readErr == nil && s.emptinessChecker.IsEmpty(updated) {
		return s.collection.Remove(ctx, filter)
	}

	return nil
}

func (s *Service) validateArrayItemExists(ctx context.Context, scope ScopeIdentifier, fieldName, alias string) error {
	filter := bson.M{
		"userId":             scope.UserID,
		"workflowId":         scope.WorkflowID,
		fieldName + ".alias": alias,
	}

	var result map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&result)

	if err == qmgo.ErrNoSuchDocuments {
		return fmt.Errorf("item with alias '%s' not found in field '%s'", alias, fieldName)
	}

	return err
}

func (s *Service) validateArrayItemDoesNotExist(ctx context.Context, scope ScopeIdentifier, fieldName, alias string) error {
	filter := bson.M{
		"userId":             scope.UserID,
		"workflowId":         scope.WorkflowID,
		fieldName + ".alias": alias,
	}

	var result map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&result)

	if err == nil {
		return fmt.Errorf("item with alias '%s' already exists in field '%s'", alias, fieldName)
	}

	if err != qmgo.ErrNoSuchDocuments {
		return err
	}

	return nil
}

func isEncryptedField(arrayName, fieldName string) bool {
	fieldConfigs, exists := GetIntegrationEncryptionConfig().ArrayFields[arrayName]
	if !exists {
		return false
	}

	for _, config := range fieldConfigs {
		if config.Path == fieldName {
			return true
		}
	}

	return false
}

func validateNoSentinelSecrets(arrayName string, item map[string]interface{}) error {
	fieldConfigs, exists := GetIntegrationEncryptionConfig().ArrayFields[arrayName]
	if !exists {
		return nil
	}

	for _, config := range fieldConfigs {
		if value, exists := item[config.Path]; exists {
			if isSentinelValue(value) || isSentinelMap(value) {
				return fmt.Errorf("invalid secret value for field '%s': sentinel value not allowed on creation", config.Path)
			}
		}
	}

	return nil
}
