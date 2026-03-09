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
	collection  *qmgo.Collection
	encryptor   *DocumentEncryptor
	fieldCrypto *FieldCrypto
}

func NewService(db *qmgo.Database) (*Service, error) {
	encryptor, err := NewDocumentEncryptor()
	if err != nil {
		return nil, err
	}

	fieldCrypto, err := NewFieldCrypto()
	if err != nil {
		return nil, err
	}

	return &Service{
		collection:  db.Collection("integrations"),
		encryptor:   encryptor,
		fieldCrypto: fieldCrypto,
	}, nil
}

func (s *Service) FindByUserID(ctx context.Context, userID string) (*models.Integration, error) {
	// Fetch as raw map to handle encrypted fields stored as strings in MongoDB.
	// Typed decode into models.Integration fails when encrypted string fields
	// cannot be decoded into typed fields like map[string]string.
	var raw map[string]interface{}
	if err := s.collection.Find(ctx, qmgo.M{"userId": userID}).One(&raw); err != nil {
		return nil, err
	}

	// Normalize: qmgo/mongo-driver decodes embedded BSON documents as primitive.D
	// (ordered slice) rather than map[string]interface{}, causing type assertions
	// inside transformArrayFields to fail silently and skip decryption.
	// Converting to plain maps/slices first ensures Decrypt works correctly.
	normalizeBSONDoc(raw)

	// Decrypt in-place so serialised fields (e.g. headers) become their proper
	// types (map[string]interface{}) before the BSON round-trip below.
	if err := s.encryptor.Decrypt(raw); err != nil {
		return nil, err
	}

	rawBytes, err := bson.Marshal(raw)
	if err != nil {
		return nil, err
	}
	var integration models.Integration
	if err := bson.Unmarshal(rawBytes, &integration); err != nil {
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

	if err := s.encryptor.Encrypt(updateDoc); err != nil {
		return err
	}

	filter := qmgo.M{"userId": userID}
	updateOp := bson.M{"$set": updateDoc}

	var existing map[string]interface{}
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

func (s *Service) DecryptIntegration(integration *models.Integration) (*models.Integration, error) {
	integrationBytes, err := bson.Marshal(integration)
	if err != nil {
		return nil, err
	}

	var integrationMap map[string]interface{}
	if err := bson.Unmarshal(integrationBytes, &integrationMap); err != nil {
		return nil, err
	}

	if err := s.encryptor.Decrypt(integrationMap); err != nil {
		return nil, err
	}

	decryptedBytes, err := bson.Marshal(integrationMap)
	if err != nil {
		return nil, err
	}

	var decrypted models.Integration
	if err := bson.Unmarshal(decryptedBytes, &decrypted); err != nil {
		return nil, err
	}

	return &decrypted, nil
}

func (s *Service) Delete(ctx context.Context, userID string) error {
	return s.collection.Remove(ctx, qmgo.M{"userId": userID})
}

/* UpdateRaw applies raw MongoDB update operations (e.g., $unset) without setDefaultFields */
func (s *Service) UpdateRaw(ctx context.Context, userID string, update map[string]interface{}) error {
	filter := qmgo.M{"userId": userID}

	var existing map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&existing)

	if err == qmgo.ErrNoSuchDocuments {
		return nil /* No document to update - DELETE on non-existent is success */
	}

	if err != nil {
		return err
	}

	/* Force synchronous write - wait for MongoDB acknowledgment before returning */
	err = s.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	/* Verify deletion completed by reading back */
	var updated map[string]interface{}
	readErr := s.collection.Find(ctx, filter).One(&updated)
	if readErr != nil && readErr != qmgo.ErrNoSuchDocuments {
		return readErr
	}

	return nil
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

// normalizeBSONDoc converts all primitive.D/primitive.A values in a top-level
// map to plain map[string]interface{}/[]interface{} recursively.
// This is required because the mongo-driver decodes embedded BSON documents
// within arrays as primitive.D, not map[string]interface{}, which breaks type
// assertions in the encryption layer.
func normalizeBSONDoc(doc map[string]interface{}) {
	for k, v := range doc {
		doc[k] = normalizeBSONValue(v)
	}
}

func normalizeBSONValue(v interface{}) interface{} {
	switch val := v.(type) {
	case primitive.D:
		m := make(map[string]interface{}, len(val))
		for _, e := range val {
			m[e.Key] = normalizeBSONValue(e.Value)
		}
		return m
	case primitive.A:
		s := make([]interface{}, len(val))
		for i, e := range val {
			s[i] = normalizeBSONValue(e)
		}
		return s
	case map[string]interface{}:
		for k, e := range val {
			val[k] = normalizeBSONValue(e)
		}
		return val
	case []interface{}:
		for i, e := range val {
			val[i] = normalizeBSONValue(e)
		}
		return val
	default:
		return v
	}
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
			Store: map[string]map[string][]models.MemoryVector{
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
