package llmvector

import (
	"context"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"backend-v2/internal/database"
	"backend-v2/internal/models"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(collection *qmgo.Collection) *Service {
	return &Service{collection: collection}
}

func (s *Service) GetContext(ctx context.Context, name *string, userID string) (*models.LLMVector, error) {
	var context models.LLMVector
	filter := bson.M{"userId": userID, "name": name}
	err := s.collection.Find(ctx, filter).One(&context)
	return &context, err
}

func (s *Service) GetAllContexts(ctx context.Context, userID string) ([]models.LLMVector, error) {
	contexts := []models.LLMVector{}
	filter := bson.M{"userId": userID}
	err := s.collection.Find(ctx, filter).All(&contexts)
	return contexts, err
}

func (s *Service) SaveContext(ctx context.Context, name *string, userID, contextType string, data map[string][]models.MemoryVector, keep bool) (*models.LLMVector, error) {
	filter := bson.M{"userId": userID, "name": name}

	var existing models.LLMVector
	err := s.collection.Find(ctx, filter).One(&existing)

	now := time.Now()

	if err != nil {
		newDoc := bson.M{
			"_id":       primitive.NewObjectID(),
			"userId":    userID,
			"name":      name,
			"store":     map[string]map[string][]models.MemoryVector{contextType: data},
			"createdAt": now,
			"updatedAt": now,
		}
		if upsertErr := database.AtomicUpsertOne(ctx, s.collection, filter, bson.M{"$setOnInsert": newDoc}); upsertErr != nil {
			return nil, upsertErr
		}
		var inserted models.LLMVector
		if readErr := s.collection.Find(ctx, filter).One(&inserted); readErr != nil {
			return nil, readErr
		}
		return &inserted, nil
	}

	if existing.Store == nil {
		existing.Store = make(map[string]map[string][]models.MemoryVector)
	}

	if !keep {
		existing.Store[contextType] = data
	} else {
		if existing.Store[contextType] == nil {
			existing.Store[contextType] = make(map[string][]models.MemoryVector)
		}

		for source, vectors := range data {
			if existingVectors, ok := existing.Store[contextType][source]; ok {
				existing.Store[contextType][source] = append(existingVectors, vectors...)
			} else {
				existing.Store[contextType][source] = vectors
			}
		}
	}

	existing.UpdatedAt = now

	update := bson.M{
		"$set": bson.M{
			"store":     existing.Store,
			"updatedAt": now,
		},
	}

	err = s.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, err
	}

	return &existing, nil
}

func (s *Service) DeleteContext(ctx context.Context, name *string, userID string, contextType *string, sources []string) error {
	filter := bson.M{"userId": userID, "name": name}

	var existing models.LLMVector
	err := s.collection.Find(ctx, filter).One(&existing)
	if err != nil {
		return err
	}

	if contextType == nil {
		return s.collection.Remove(ctx, filter)
	}

	if len(sources) > 0 {
		if typeStore, ok := existing.Store[*contextType]; ok {
			for _, source := range sources {
				delete(typeStore, source)
			}

			if len(typeStore) == 0 {
				delete(existing.Store, *contextType)
			}
		}

		update := bson.M{"$set": bson.M{"store": existing.Store, "updatedAt": time.Now()}}
		return s.collection.UpdateOne(ctx, filter, update)
	}

	if _, ok := existing.Store[*contextType]; ok {
		delete(existing.Store, *contextType)
		update := bson.M{"$set": bson.M{"store": existing.Store, "updatedAt": time.Now()}}
		return s.collection.UpdateOne(ctx, filter, update)
	}

	return nil
}

func (s *Service) GetOverview(ctx context.Context, userID string, filterType *string) (map[string]map[string][]string, error) {
	contexts := []models.LLMVector{}
	filter := bson.M{"userId": userID}
	err := s.collection.Find(ctx, filter).All(&contexts)
	if err != nil {
		return nil, err
	}

	overview := make(map[string]map[string][]string)

	for _, context := range contexts {
		contextKey := ""
		if context.Name != nil {
			contextKey = *context.Name
		}

		overview[contextKey] = make(map[string][]string)

		for storeType, typeStore := range context.Store {
			if filterType == nil || *filterType == storeType {
				sources := make([]string, 0, len(typeStore))
				for source := range typeStore {
					sources = append(sources, source)
				}
				overview[contextKey][storeType] = sources
			}
		}
	}

	return overview, nil
}
