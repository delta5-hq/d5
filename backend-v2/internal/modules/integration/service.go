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
	collection            *qmgo.Collection
	encryptor             *DocumentEncryptor
	fieldCrypto           *FieldCrypto
	fallbackFinder        *FallbackFinder
	secretRedactor        *SecretRedactor
	serviceFieldExtractor *ServiceFieldExtractor
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

	collection := db.Collection("integrations")
	fallbackFinder := newFallbackFinder(collection, encryptor)
	secretRedactor := NewSecretRedactor()
	serviceFieldExtractor := NewServiceFieldExtractor(secretRedactor)

	return &Service{
		collection:            collection,
		encryptor:             encryptor,
		fieldCrypto:           fieldCrypto,
		fallbackFinder:        fallbackFinder,
		secretRedactor:        secretRedactor,
		serviceFieldExtractor: serviceFieldExtractor,
	}, nil
}

func (s *Service) FindByUserID(ctx context.Context, userID string) (*models.Integration, error) {
	return s.FindWithFallback(ctx, ScopeIdentifier{UserID: userID, WorkflowID: nil})
}

func (s *Service) FindWithFallback(ctx context.Context, scope ScopeIdentifier) (*models.Integration, error) {
	return s.fallbackFinder.findWithFallback(ctx, scope)
}

func (s *Service) Upsert(ctx context.Context, scope ScopeIdentifier, update map[string]interface{}) error {
	s.setDefaultFields(update, scope)

	updateDoc := bson.M{}
	for k, v := range update {
		updateDoc[k] = v
	}

	if err := s.encryptor.Encrypt(updateDoc); err != nil {
		return err
	}

	filter := buildScopeFilter(scope)
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

func (s *Service) setDefaultFields(fields map[string]interface{}, scope ScopeIdentifier) {
	fields["userId"] = scope.UserID
	fields["workflowId"] = scope.WorkflowID

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

func (s *Service) PrepareSecureIntegrationResponse(integration *models.Integration) (*models.IntegrationWithMetadata, error) {
	decrypted, err := s.DecryptIntegration(integration)
	if err != nil {
		return nil, err
	}

	metadata := s.secretRedactor.BuildMetadataFromIntegration(decrypted)
	s.secretRedactor.RedactSecretsFromIntegration(decrypted)

	return &models.IntegrationWithMetadata{
		Integration: decrypted,
		SecretsMeta: metadata,
	}, nil
}

func (s *Service) PrepareSecureServiceFieldResponse(integration *models.Integration, fieldName string) (map[string]interface{}, error) {
	decrypted, err := s.DecryptIntegration(integration)
	if err != nil {
		return nil, err
	}

	return s.serviceFieldExtractor.ExtractSecureServiceField(decrypted, fieldName)
}

func (s *Service) Delete(ctx context.Context, scope ScopeIdentifier) error {
	filter := buildScopeFilter(scope)
	return s.collection.Remove(ctx, filter)
}

func (s *Service) UpdateRaw(ctx context.Context, scope ScopeIdentifier, update map[string]interface{}) error {
	filter := buildScopeFilter(scope)

	var existing map[string]interface{}
	err := s.collection.Find(ctx, filter).One(&existing)

	if err == qmgo.ErrNoSuchDocuments {
		return nil
	}

	if err != nil {
		return err
	}

	err = s.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

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
