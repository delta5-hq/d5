package integration

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *Service {
	return &Service{
		collection: db.Collection("integrations"),
	}
}

func (s *Service) FindByUserID(ctx context.Context, userID string) (*models.Integration, error) {
	var integration models.Integration
	err := s.collection.Find(ctx, qmgo.M{"userId": userID}).One(&integration)
	if err != nil {
		return nil, err
	}
	return &integration, nil
}

func (s *Service) Upsert(ctx context.Context, userID string, update map[string]interface{}) error {
	update["userId"] = userID
	
	if _, ok := update["lang"]; !ok {
		update["lang"] = "none"
	}
	if _, ok := update["model"]; !ok {
		update["model"] = "auto"
	}

	_, err := s.collection.Upsert(ctx, qmgo.M{"userId": userID}, update)
	return err
}

func (s *Service) Delete(ctx context.Context, userID string) error {
	return s.collection.Remove(ctx, qmgo.M{"userId": userID})
}

func (s *Service) CreateLLMVector(ctx context.Context, db *qmgo.Database, userID string, service string) (*models.LLMVector, error) {
	vectorsCollection := db.Collection("llmvectors")
	
	var vector models.LLMVector
	err := vectorsCollection.Find(ctx, qmgo.M{"userId": userID, "name": nil}).One(&vector)
	
	if err == qmgo.ErrNoSuchDocuments {
		vector = models.LLMVector{
			UserID: userID,
			Name:   nil,
			Store:  map[string]map[string][]models.MemoryVector{service: {}},
		}
		
		result, insertErr := vectorsCollection.InsertOne(ctx, vector)
		if insertErr != nil {
			return nil, insertErr
		}
		
		oid := result.InsertedID.(primitive.ObjectID)
		vector.ID = oid
		return &vector, nil
	}
	
	if err != nil {
		return nil, err
	}
	
	if vector.Store == nil {
		vector.Store = make(map[string]map[string][]models.MemoryVector)
	}
	
	if _, exists := vector.Store[service]; !exists {
		vector.Store[service] = map[string][]models.MemoryVector{}
		_, err = vectorsCollection.Upsert(ctx, qmgo.M{"userId": userID, "name": nil}, 
			bson.M{"$set": bson.M{"store." + service: map[string][]models.MemoryVector{}}})
		if err != nil {
			return nil, err
		}
	}
	
	return &vector, nil
}
