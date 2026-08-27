package integration

import (
	"backend-v2/internal/database"
	"context"
	"fmt"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

const addItemMaxAttempts = 4

func (s *Service) AddArrayItem(ctx context.Context, scope ScopeIdentifier, fieldName string, item map[string]interface{}) error {
	alias, ok := item["alias"].(string)
	if !ok || alias == "" {
		return fmt.Errorf("alias is required")
	}

	if err := validateArrayItemShape(fieldName, item); err != nil {
		return err
	}

	if err := s.validateArrayItemDoesNotExist(ctx, scope, fieldName, alias); err != nil {
		return err
	}

	if err := s.validateCrossTypeAliasUniqueness(ctx, scope, fieldName, alias); err != nil {
		return err
	}

	if err := validateNoSentinelSecrets(fieldName, item); err != nil {
		return err
	}

	encryptedItem, err := s.encryptArrayItem(scope, fieldName, item)
	if err != nil {
		return err
	}

	return s.atomicAddItem(ctx, scope, fieldName, alias, encryptedItem)
}

func (s *Service) atomicAddItem(ctx context.Context, scope ScopeIdentifier, fieldName, alias string, encryptedItem map[string]interface{}) error {
	for attempt := 0; attempt < addItemMaxAttempts; attempt++ {
		if err := s.ensureScopeDocument(ctx, scope); err != nil && !qmgo.IsDup(err) {
			return err
		}

		pushErr := s.conditionalPushArrayItem(ctx, scope, fieldName, alias, encryptedItem)
		if pushErr == nil {
			return nil
		}
		if pushErr != qmgo.ErrNoSuchDocuments {
			return pushErr
		}

		if err := s.validateArrayItemDoesNotExist(ctx, scope, fieldName, alias); err != nil {
			return err
		}
		if err := s.validateCrossTypeAliasUniqueness(ctx, scope, fieldName, alias); err != nil {
			return err
		}
	}

	return fmt.Errorf("concurrent write conflict: could not add '%s' after %d attempts", alias, addItemMaxAttempts)
}

func (s *Service) ensureScopeDocument(ctx context.Context, scope ScopeIdentifier) error {
	return database.AtomicUpsertOne(ctx, s.collection, buildScopeFilter(scope), bson.M{
		"$setOnInsert": bson.M{
			"userId":     scope.UserID,
			"workflowId": scope.WorkflowID,
			"lang":       defaultLanguage,
			"model":      defaultModel,
		},
	})
}

func (s *Service) conditionalPushArrayItem(ctx context.Context, scope ScopeIdentifier, fieldName, alias string, encryptedItem map[string]interface{}) error {
	filter := buildScopeFilter(scope)
	filter[fieldName+".alias"] = bson.M{"$ne": alias}
	for _, otherField := range GetOtherArrayFields(fieldName) {
		filter[otherField+".alias"] = bson.M{"$ne": alias}
	}
	return s.collection.UpdateOne(ctx, filter, bson.M{"$push": bson.M{fieldName: encryptedItem}})
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
	if err := normalizeArrayItemUpdateAlias(alias, updates); err != nil {
		return err
	}

	if err := validateArrayItemUpdateShape(fieldName, updates); err != nil {
		return err
	}

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

	if len(setFields) == 0 {
		return nil
	}

	update := bson.M{"$set": setFields}

	return s.collection.UpdateOne(ctx, filter, update)
}

func normalizeArrayItemUpdateAlias(pathAlias string, updates map[string]interface{}) error {
	value, exists := updates["alias"]
	if !exists {
		return nil
	}

	bodyAlias, ok := value.(string)
	if !ok || bodyAlias != pathAlias {
		return arrayItemValidationError{message: "alias cannot be changed after creation"}
	}

	delete(updates, "alias")
	return nil
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

	removeFilter := buildScopeFilter(scope)
	for k, v := range s.emptinessChecker.MongoEmptyConditions() {
		removeFilter[k] = v
	}
	if err := s.collection.Remove(ctx, removeFilter); err != nil && err != qmgo.ErrNoSuchDocuments {
		return err
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

func (s *Service) aliasExistsInField(ctx context.Context, scope ScopeIdentifier, fieldName, alias string) (bool, error) {
	filter := bson.M{
		"userId":             scope.UserID,
		"workflowId":         scope.WorkflowID,
		fieldName + ".alias": alias,
	}

	var result map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&result)

	if err == nil {
		return true, nil
	}

	if err == qmgo.ErrNoSuchDocuments {
		return false, nil
	}

	return false, err
}

func (s *Service) validateCrossTypeAliasUniqueness(ctx context.Context, scope ScopeIdentifier, fieldName, alias string) error {
	otherFields := GetOtherArrayFields(fieldName)

	for _, otherField := range otherFields {
		found, err := s.aliasExistsInField(ctx, scope, otherField, alias)
		if err != nil {
			return err
		}
		if found {
			return fmt.Errorf("alias '%s' already exists in field '%s'", alias, otherField)
		}
	}

	if scope.WorkflowID == nil {
		return nil
	}

	globalScope := ScopeIdentifier{UserID: scope.UserID, WorkflowID: nil}

	for _, otherField := range otherFields {
		found, err := s.aliasExistsInField(ctx, globalScope, otherField, alias)
		if err != nil {
			return err
		}
		if found {
			return fmt.Errorf("alias '%s' already exists in field '%s' (inherited from global scope)", alias, otherField)
		}
	}

	return nil
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
