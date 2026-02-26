package integration

import (
	"context"
	"fmt"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

func (s *Service) AddArrayItem(ctx context.Context, userID, fieldName string, item map[string]interface{}) error {
	alias, ok := item["alias"].(string)
	if !ok || alias == "" {
		return fmt.Errorf("alias is required")
	}

	if err := s.validateArrayItemDoesNotExist(ctx, userID, fieldName, alias); err != nil {
		return err
	}

	filter := qmgo.M{"userId": userID}
	update := bson.M{"$push": bson.M{fieldName: item}}

	var existing map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&existing)

	if err == qmgo.ErrNoSuchDocuments {
		newDoc := bson.M{
			"userId":  userID,
			"lang":    defaultLanguage,
			"model":   defaultModel,
			fieldName: []interface{}{item},
		}
		_, insertErr := s.collection.InsertOne(ctx, newDoc)
		return insertErr
	}

	if err != nil {
		return err
	}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) UpdateArrayItem(ctx context.Context, userID, fieldName, alias string, updates map[string]interface{}) error {
	if err := s.validateArrayItemExists(ctx, userID, fieldName, alias); err != nil {
		return err
	}

	filter := bson.M{
		"userId":             userID,
		fieldName + ".alias": alias,
	}

	setFields := bson.M{}
	for key, value := range updates {
		if key != "alias" {
			setFields[fieldName+".$."+key] = value
		}
	}

	update := bson.M{"$set": setFields}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) DeleteArrayItem(ctx context.Context, userID, fieldName, alias string) error {
	filter := qmgo.M{"userId": userID}
	update := bson.M{
		"$pull": bson.M{
			fieldName: bson.M{"alias": alias},
		},
	}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) validateArrayItemExists(ctx context.Context, userID, fieldName, alias string) error {
	filter := bson.M{
		"userId":             userID,
		fieldName + ".alias": alias,
	}

	var result map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&result)

	if err == qmgo.ErrNoSuchDocuments {
		return fmt.Errorf("item with alias '%s' not found in field '%s'", alias, fieldName)
	}

	return err
}

func (s *Service) validateArrayItemDoesNotExist(ctx context.Context, userID, fieldName, alias string) error {
	filter := bson.M{
		"userId":             userID,
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
