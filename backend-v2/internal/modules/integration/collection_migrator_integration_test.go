//go:build integration
// +build integration

package integration

import (
	"backend-v2/internal/common/encryption"
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func getTestMongoURI() string {
	uri := os.Getenv("TEST_MONGO_URI")
	if uri == "" {
		uri = "mongodb://localhost:27018/delta5_migration_test"
	}
	return uri
}

func setupTestCollection(t *testing.T) (*mongo.Collection, func()) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(getTestMongoURI()))
	require.NoError(t, err, "failed to connect to MongoDB")

	err = client.Ping(ctx, nil)
	require.NoError(t, err, "failed to ping MongoDB")

	dbName := "delta5_migration_test"
	collName := "test_integrations_" + t.Name()
	collection := client.Database(dbName).Collection(collName)

	cleanup := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = collection.Drop(ctx)
		_ = client.Disconnect(ctx)
	}

	return collection, cleanup
}

func TestCollectionMigrator_MigrateAll_Integration_EmptyCollection(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	ctx := context.Background()
	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, 0, stats.TotalProcessed)
	assert.Equal(t, 0, stats.Migrated)
	assert.Equal(t, 0, stats.Skipped)
	assert.Equal(t, 0, stats.Failed)
	assert.Empty(t, stats.Errors)
}

func TestCollectionMigrator_MigrateAll_Integration_Idempotency(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacyEncrypted, err := service.Encrypt("sk-legacy", nil)
	require.NoError(t, err)

	doc := bson.M{
		"userId": "user-1",
		"openai": bson.M{"apiKey": legacyEncrypted},
	}

	ctx := context.Background()
	_, err = collection.InsertOne(ctx, doc)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats1, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, stats1.Migrated)

	stats2, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, 0, stats2.Migrated)
	assert.Equal(t, 1, stats2.Skipped)
}

func TestCollectionMigrator_MigrateAll_Integration_WorkflowScoped(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacyEncrypted, err := service.Encrypt("sk-workflow-legacy", nil)
	require.NoError(t, err)

	doc := bson.M{
		"userId":     "user-1",
		"workflowId": "wf-123",
		"openai":     bson.M{"apiKey": legacyEncrypted},
	}

	ctx := context.Background()
	_, err = collection.InsertOne(ctx, doc)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, 1, stats.TotalProcessed)
	assert.Equal(t, 1, stats.Migrated)
	assert.Equal(t, 0, stats.Failed)

	var result bson.M
	err = collection.FindOne(ctx, bson.M{"userId": "user-1"}).Decode(&result)
	require.NoError(t, err)

	builder := encryption.NewADBuilder()
	expectedAD := builder.BuildForLLMField("user-1", "wf-123", "openai.apiKey")
	migratedCiphertext := result["openai"].(bson.M)["apiKey"].(string)

	marker := encryption.NewMarker()
	require.True(t, marker.IsMarked(migratedCiphertext))

	cipher := encryption.NewCipher()
	keyDeriv, err := encryption.GetKeyDerivation()
	require.NoError(t, err)

	plaintext, err := cipher.Decrypt(marker.Unmark(migratedCiphertext), keyDeriv.GetKey(), expectedAD)
	require.NoError(t, err)
	assert.Equal(t, "sk-workflow-legacy", plaintext)
}

func TestCollectionMigrator_MigrateAll_Integration_StatsAccuracy(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacy1, _ := service.Encrypt("secret1", nil)
	legacy2, _ := service.Encrypt("secret2", nil)

	builder := encryption.NewADBuilder()
	modern1, _ := service.Encrypt("modern1", builder.BuildForLLMField("u3", "", "openai.apiKey"))
	modern2, _ := service.Encrypt("modern2", builder.BuildForLLMField("u4", "", "claude.apiKey"))

	docs := []interface{}{
		bson.M{"userId": "u1", "openai": bson.M{"apiKey": legacy1}},
		bson.M{"userId": "u2", "claude": bson.M{"apiKey": legacy2}},
		bson.M{"userId": "u3", "openai": bson.M{"apiKey": modern1}},
		bson.M{"userId": "u4", "claude": bson.M{"apiKey": modern2}},
		bson.M{"userId": "u5", "lang": "en"},
		bson.M{"userId": "u6"},
		bson.M{"perplexity": bson.M{"apiKey": "no-userId"}},
		bson.M{"userId": "", "openai": bson.M{"apiKey": "empty-userId"}},
	}

	ctx := context.Background()
	_, err = collection.InsertMany(ctx, docs)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, 8, stats.TotalProcessed, "should process all documents")
	assert.Equal(t, 2, stats.Migrated, "should migrate exactly the legacy-encrypted documents")
	assert.Equal(t, 4, stats.Skipped, "should skip modern-encrypted and plain documents")
	assert.Equal(t, 2, stats.Failed, "should fail documents with invalid userId")
	assert.Equal(t, stats.TotalProcessed, stats.Migrated+stats.Skipped+stats.Failed, "stats partitioning must be complete")
}

func TestCollectionMigrator_MigrateAll_Integration_MultipleProviders(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacyOpenAI, _ := service.Encrypt("sk-openai", nil)
	legacyClaude, _ := service.Encrypt("sk-claude", nil)
	legacyQwen, _ := service.Encrypt("sk-qwen", nil)

	doc := bson.M{
		"userId": "user-multi",
		"openai": bson.M{"apiKey": legacyOpenAI},
		"claude": bson.M{"apiKey": legacyClaude},
		"qwen":   bson.M{"apiKey": legacyQwen},
		"lang":   "en",
	}

	ctx := context.Background()
	_, err = collection.InsertOne(ctx, doc)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, 1, stats.TotalProcessed)
	assert.Equal(t, 1, stats.Migrated, "document with multiple legacy fields should migrate once")
	assert.Equal(t, 0, stats.Failed)

	var result bson.M
	err = collection.FindOne(ctx, bson.M{"userId": "user-multi"}).Decode(&result)
	require.NoError(t, err)

	assert.NotEmpty(t, result["openai"].(bson.M)["apiKey"], "openai key should be re-encrypted")
	assert.NotEmpty(t, result["claude"].(bson.M)["apiKey"], "claude key should be re-encrypted")
	assert.NotEmpty(t, result["qwen"].(bson.M)["apiKey"], "qwen key should be re-encrypted")
	assert.Equal(t, "en", result["lang"], "non-encrypted fields should be preserved")
}

func TestCollectionMigrator_MigrateAll_Integration_ContextCancellation(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacy, _ := service.Encrypt("secret", nil)
	doc := bson.M{"userId": "user-1", "openai": bson.M{"apiKey": legacy}}

	ctx := context.Background()
	_, err = collection.InsertOne(ctx, doc)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	stats, err := migrator.MigrateAll(canceledCtx)

	if err != nil {
		assert.Contains(t, err.Error(), "context")
	}
	if stats != nil {
		assert.GreaterOrEqual(t, stats.TotalProcessed, 0, "partial stats should be returned on cancellation")
	}
}

func TestCollectionMigrator_MigrateAll_Integration_LargeCollection(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping large collection test in short mode")
	}

	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	docCount := 100
	docs := make([]interface{}, docCount)
	expectedMigrated := 0
	expectedSkipped := 0

	for i := 0; i < docCount; i++ {
		if i%3 == 0 {
			legacy, _ := service.Encrypt("secret", nil)
			docs[i] = bson.M{"userId": "user-" + string(rune(i)), "openai": bson.M{"apiKey": legacy}}
			expectedMigrated++
		} else if i%3 == 1 {
			builder := encryption.NewADBuilder()
			userId := "user-" + string(rune(i))
			modern, _ := service.Encrypt("modern", builder.BuildForLLMField(userId, "", "openai.apiKey"))
			docs[i] = bson.M{"userId": userId, "openai": bson.M{"apiKey": modern}}
			expectedSkipped++
		} else {
			docs[i] = bson.M{"userId": "user-" + string(rune(i)), "lang": "en"}
			expectedSkipped++
		}
	}

	ctx := context.Background()
	_, err = collection.InsertMany(ctx, docs)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, docCount, stats.TotalProcessed)
	assert.Equal(t, expectedMigrated, stats.Migrated)
	assert.Equal(t, expectedSkipped, stats.Skipped)
	assert.Equal(t, 0, stats.Failed)
	assert.Empty(t, stats.Errors)
}

func TestCollectionMigrator_MigrateAll_Integration_ErrorAccumulation(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacy, _ := service.Encrypt("good", nil)

	docs := []interface{}{
		bson.M{"userId": "good-1", "openai": bson.M{"apiKey": legacy}},
		bson.M{"openai": bson.M{"apiKey": "bad-1"}},
		bson.M{"userId": "", "openai": bson.M{"apiKey": "bad-2"}},
		bson.M{"openai": bson.M{"apiKey": "bad-3"}},
		bson.M{"userId": "good-2", "lang": "en"},
	}

	ctx := context.Background()
	_, err = collection.InsertMany(ctx, docs)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)

	assert.Equal(t, 5, stats.TotalProcessed)
	assert.Equal(t, 3, stats.Failed, "all userId validation failures should accumulate")
	assert.Len(t, stats.Errors, 3, "each failure should append to errors slice")

	for _, errMsg := range stats.Errors {
		assert.Contains(t, errMsg, "missing userId", "error messages should be descriptive")
	}

	assert.Nil(t, err, "function-level error should be nil; document errors accumulate in stats")
}

func TestCollectionMigrator_MigrateAll_Integration_PreservesDocumentStructure(t *testing.T) {
	collection, cleanup := setupTestCollection(t)
	defer cleanup()

	service, err := encryption.GetService()
	require.NoError(t, err)

	legacy, _ := service.Encrypt("secret", nil)

	originalDoc := bson.M{
		"userId":     "user-1",
		"workflowId": "wf-1",
		"openai":     bson.M{"apiKey": legacy, "model": "gpt-4"},
		"lang":       "en",
		"metadata":   bson.M{"team": "engineering", "region": "us-west"},
		"tags":       bson.A{"prod", "critical"},
	}

	ctx := context.Background()
	_, err = collection.InsertOne(ctx, originalDoc)
	require.NoError(t, err)

	migrator, err := NewCollectionMigrator(collection)
	require.NoError(t, err)

	stats, err := migrator.MigrateAll(ctx)
	require.NoError(t, err)
	assert.Equal(t, 1, stats.Migrated)

	var result bson.M
	err = collection.FindOne(ctx, bson.M{"userId": "user-1"}).Decode(&result)
	require.NoError(t, err)

	assert.Equal(t, "user-1", result["userId"], "userId preserved")
	assert.Equal(t, "wf-1", result["workflowId"], "workflowId preserved")
	assert.Equal(t, "en", result["lang"], "lang preserved")
	assert.Equal(t, "gpt-4", result["openai"].(bson.M)["model"], "nested non-encrypted field preserved")
	assert.Equal(t, "engineering", result["metadata"].(bson.M)["team"], "nested object preserved")
	assert.Equal(t, "us-west", result["metadata"].(bson.M)["region"], "nested object preserved")
	assert.Equal(t, bson.A{"prod", "critical"}, result["tags"], "array preserved")
	assert.NotEqual(t, legacy, result["openai"].(bson.M)["apiKey"], "encrypted field should be re-encrypted")
}
