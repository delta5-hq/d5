package llmvector

import (
	"context"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"backend-v2/internal/models"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(collection *qmgo.Collection) *Service {
	return &Service{collection: collection}
}

/* Get context by name and userId */
func (s *Service) GetContext(ctx context.Context, name *string, userID string) (*models.LLMVector, error) {
	var context models.LLMVector
	filter := bson.M{"userId": userID, "name": name}
	err := s.collection.Find(ctx, filter).One(&context)
	return &context, err
}

/* Get all contexts for user */
func (s *Service) GetAllContexts(ctx context.Context, userID string) ([]models.LLMVector, error) {
	var contexts []models.LLMVector
	filter := bson.M{"userId": userID}
	err := s.collection.Find(ctx, filter).All(&contexts)
	return contexts, err
}

/* Save or update context */
func (s *Service) SaveContext(ctx context.Context, name *string, userID, contextType string, data map[string][]models.MemoryVector, keep bool) (*models.LLMVector, error) {
	filter := bson.M{"userId": userID, "name": name}

	var existing models.LLMVector
	err := s.collection.Find(ctx, filter).One(&existing)

	now := time.Now()

	if err != nil {
		// Create new context
		newContext := models.LLMVector{
			ID:        primitive.NewObjectID(),
			UserID:    userID,
			Name:      name,
			Store:     make(map[string]map[string][]models.MemoryVector),
			CreatedAt: now,
			UpdatedAt: now,
		}
		newContext.Store[contextType] = data

		_, err = s.collection.InsertOne(ctx, newContext)
		if err != nil {
			return nil, err
		}
		return &newContext, nil
	}

	// Update existing context
	if existing.Store == nil {
		existing.Store = make(map[string]map[string][]models.MemoryVector)
	}

	if !keep {
		// Replace type data
		existing.Store[contextType] = data
	} else {
		// Append to existing type
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

/* Delete context, type, or specific sources */
func (s *Service) DeleteContext(ctx context.Context, name *string, userID string, contextType *string, sources []string) error {
	filter := bson.M{"userId": userID, "name": name}

	var existing models.LLMVector
	err := s.collection.Find(ctx, filter).One(&existing)
	if err != nil {
		return err
	}

	// Delete entire context if no type specified
	if contextType == nil {
		return s.collection.Remove(ctx, filter)
	}

	// Delete specific sources from type
	if len(sources) > 0 {
		if typeStore, ok := existing.Store[*contextType]; ok {
			for _, source := range sources {
				delete(typeStore, source)
			}

			// If type is empty, remove it
			if len(typeStore) == 0 {
				delete(existing.Store, *contextType)
			}
		}

		update := bson.M{"$set": bson.M{"store": existing.Store, "updatedAt": time.Now()}}
		return s.collection.UpdateOne(ctx, filter, update)
	}

	// Delete entire type
	if _, ok := existing.Store[*contextType]; ok {
		delete(existing.Store, *contextType)
		update := bson.M{"$set": bson.M{"store": existing.Store, "updatedAt": time.Now()}}
		return s.collection.UpdateOne(ctx, filter, update)
	}

	return nil
}

/* Get overview of all contexts (metadata only) */
func (s *Service) GetOverview(ctx context.Context, userID string, filterType *string) (map[string]map[string][]string, error) {
	var contexts []models.LLMVector
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
