package integration

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type FallbackFinder struct {
	collection  *qmgo.Collection
	encryptor   *DocumentEncryptor
	normalizer  bsonDocumentNormalizer
	unmarshaler bsonUnmarshaler
}

type bsonDocumentNormalizer func(map[string]interface{})

type bsonUnmarshaler func([]byte, interface{}) error

func newFallbackFinder(
	collection *qmgo.Collection,
	encryptor *DocumentEncryptor,
) *FallbackFinder {
	return &FallbackFinder{
		collection:  collection,
		encryptor:   encryptor,
		normalizer:  normalizeBSONDoc,
		unmarshaler: bson.Unmarshal,
	}
}

func (f *FallbackFinder) findWithFallback(ctx context.Context, scope ScopeIdentifier) (*models.Integration, error) {
	if scope.WorkflowID != nil {
		workflowScoped, err := f.findByScope(ctx, scope)
		if err == nil {
			return workflowScoped, nil
		}
		if err != qmgo.ErrNoSuchDocuments {
			return nil, err
		}
	}

	userLevelScope := ScopeIdentifier{
		UserID:     scope.UserID,
		WorkflowID: nil,
	}
	return f.findByScope(ctx, userLevelScope)
}

func (f *FallbackFinder) findByScope(ctx context.Context, scope ScopeIdentifier) (*models.Integration, error) {
	var raw map[string]interface{}
	filter := buildScopeFilter(scope)

	if err := f.collection.Find(ctx, filter).One(&raw); err != nil {
		return nil, err
	}

	f.normalizer(raw)

	userID, _ := raw["userId"].(string)
	var workflowID *string
	if wfID, ok := raw["workflowId"].(string); ok && wfID != "" {
		workflowID = &wfID
	}

	if err := f.encryptor.Decrypt(raw, userID, workflowID); err != nil {
		return nil, err
	}

	rawBytes, err := bson.Marshal(raw)
	if err != nil {
		return nil, err
	}

	var integration models.Integration
	if err := f.unmarshaler(rawBytes, &integration); err != nil {
		return nil, err
	}

	return &integration, nil
}

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
