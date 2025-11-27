package integration

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	defaultLanguage = "none"
	defaultModel    = "auto"
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
	s.setDefaultFields(update, userID)
	
	updateDoc := bson.M{}
	for k, v := range update {
		updateDoc[k] = v
	}
	
	filter := qmgo.M{"userId": userID}
	updateOp := bson.M{"$set": updateDoc}
	
	var existing models.Integration
	err := s.collection.Find(ctx, filter).One(&existing)
	
	if err == qmgo.ErrNoSuchDocuments {
		_, insertErr := s.collection.InsertOne(ctx, updateDoc)
		return insertErr
	}
	
	if err != nil {
		return err
	}
	
	return s.collection.UpdateOne(ctx, filter, updateOp)
}

func (s *Service) setDefaultFields(fields map[string]interface{}, userID string) {
	fields["userId"] = userID
	
	if _, exists := fields["lang"]; !exists {
		fields["lang"] = defaultLanguage
	}
	if _, exists := fields["model"]; !exists {
		fields["model"] = defaultModel
	}
}

func (s *Service) Delete(ctx context.Context, userID string) error {
	return s.collection.Remove(ctx, qmgo.M{"userId": userID})
}

/* UpdateRaw applies raw MongoDB update operations (e.g., $unset) without setDefaultFields */
func (s *Service) UpdateRaw(ctx context.Context, userID string, update map[string]interface{}) error {
	filter := qmgo.M{"userId": userID}
	
	var existing models.Integration
	err := s.collection.Find(ctx, filter).One(&existing)
	
	if err == qmgo.ErrNoSuchDocuments {
		return nil /* No document to update - DELETE on non-existent is success */
	}
	
	if err != nil {
		return err
	}
	
	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) CreateLLMVector(ctx context.Context, db *qmgo.Database, userID string, service string) (*models.LLMVector, error) {
	vectorsCollection := db.Collection("llmvectors")
	
	vector, err := s.findOrCreateDefaultVector(ctx, vectorsCollection, userID)
	if err != nil {
		return nil, err
	}
	
	if err := s.ensureServiceStoreExists(ctx, vectorsCollection, vector, service, userID); err != nil {
		return nil, err
	}
	
	return vector, nil
}

func (s *Service) findOrCreateDefaultVector(ctx context.Context, collection *qmgo.Collection, userID string) (*models.LLMVector, error) {
	var vector models.LLMVector
	err := collection.Find(ctx, qmgo.M{"userId": userID, "name": nil}).One(&vector)
	
	if err == qmgo.ErrNoSuchDocuments {
		return s.createDefaultVector(ctx, collection, userID)
	}
	
	return &vector, err
}

func (s *Service) createDefaultVector(ctx context.Context, collection *qmgo.Collection, userID string) (*models.LLMVector, error) {
	vector := models.LLMVector{
		UserID: userID,
		Name:   nil,
		Store:  make(map[string]map[string][]models.MemoryVector),
	}
	
	result, err := collection.InsertOne(ctx, vector)
	if err != nil {
		return nil, err
	}
	
	vector.ID = result.InsertedID.(primitive.ObjectID)
	return &vector, nil
}

func (s *Service) ensureServiceStoreExists(ctx context.Context, collection *qmgo.Collection, vector *models.LLMVector, service, userID string) error {
	if vector.Store == nil {
		vector.Store = make(map[string]map[string][]models.MemoryVector)
	}
	
	if _, exists := vector.Store[service]; exists {
		return nil
	}
	
	vector.Store[service] = make(map[string][]models.MemoryVector)
	
	/* Use Find+Insert/Update pattern (same as Upsert method) for consistency and edge case safety */
	filter := qmgo.M{"userId": userID, "name": nil}
	updateOp := bson.M{"$set": bson.M{"store." + service: make(map[string][]models.MemoryVector)}}
	
	var existing models.LLMVector
	err := collection.Find(ctx, filter).One(&existing)
	
	if err == qmgo.ErrNoSuchDocuments {
		/* Document doesn't exist - insert new llmvectors doc with service store */
		newVector := models.LLMVector{
			UserID: userID,
			Name:   nil,
			Store:  map[string]map[string][]models.MemoryVector{
				service: make(map[string][]models.MemoryVector),
			},
		}
		_, insertErr := collection.InsertOne(ctx, newVector)
		return insertErr
	}
	
	if err != nil {
		return err
	}
	
	/* Document exists - update store field with new service key */
	return collection.UpdateOne(ctx, filter, updateOp)
}
