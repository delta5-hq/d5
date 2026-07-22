//go:build integration
// +build integration

package integration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/qiniu/qmgo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson"
)

func getTestMongoURI() string {
	if uri := os.Getenv("TEST_MONGO_URI"); uri != "" {
		return uri
	}
	return "mongodb://localhost:27018/delta5_repository_test"
}

func setupTestDB(t *testing.T) (*qmgo.Database, func()) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cli, err := qmgo.NewClient(ctx, &qmgo.Config{Uri: getTestMongoURI()})
	require.NoError(t, err, "failed to connect to MongoDB")

	db := cli.Database("delta5_repository_test")

	cleanup := func() {
		dropCtx, dropCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer dropCancel()
		_ = db.Collection("integrations").DropCollection(dropCtx)
		disconnectCtx, disconnectCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer disconnectCancel()
		_ = cli.Close(disconnectCtx)
	}

	return db, cleanup
}

func insertDoc(t *testing.T, db *qmgo.Database, doc bson.M) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := db.Collection("integrations").InsertOne(ctx, doc)
	require.NoError(t, err)
}

func TestMongoRepository_FindByUserID_NoDocuments(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-no-docs")

	assert.ErrorIs(t, err, qmgo.ErrNoSuchDocuments)
	assert.Nil(t, result)
}

func TestMongoRepository_FindByUserID_UserLevelDocument(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	insertDoc(t, db, bson.M{
		"userId":     "user-with-doc",
		"workflowId": nil,
		"lang":       "en",
	})

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-with-doc")

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "user-with-doc", result.UserID)
	assert.Nil(t, result.WorkflowID)
}

func TestMongoRepository_FindByUserID_ScopeIsolation_WorkflowScopedDocumentExcluded(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	wfID := "wf-123"
	insertDoc(t, db, bson.M{
		"userId":     "user-wf-only",
		"workflowId": wfID,
		"lang":       "en",
	})

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-wf-only")

	assert.ErrorIs(t, err, qmgo.ErrNoSuchDocuments, "workflow-scoped document must not be returned by user-level query")
	assert.Nil(t, result)
}

func TestMongoRepository_FindByUserID_ScopeIsolation_UserLevelReturnedWhenBothScopesExist(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	wfID := "wf-456"
	insertDoc(t, db, bson.M{
		"userId":     "user-both-scopes",
		"workflowId": nil,
		"lang":       "en",
	})
	insertDoc(t, db, bson.M{
		"userId":     "user-both-scopes",
		"workflowId": wfID,
		"lang":       "de",
	})

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-both-scopes")

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, "user-both-scopes", result.UserID)
	assert.Nil(t, result.WorkflowID, "must return the user-level document, not the workflow-scoped one")
	assert.Equal(t, "en", result.Lang, "user-level document has lang=en; workflow-scoped has lang=de")
}

func TestMongoRepository_FindByUserID_ScopeIsolation_OtherUserDocumentNotReturned(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	insertDoc(t, db, bson.M{
		"userId":     "user-other",
		"workflowId": nil,
		"lang":       "en",
	})

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-querying")

	assert.ErrorIs(t, err, qmgo.ErrNoSuchDocuments, "another user's document must not be returned")
	assert.Nil(t, result)
}

func TestMongoRepository_FindByUserID_PopulatesIntegrationFields(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	mcpAlias := "test-mcp"
	rpcAlias := "test-rpc"
	insertDoc(t, db, bson.M{
		"userId":     "user-with-integrations",
		"workflowId": nil,
		"lang":       "en",
		"mcp": bson.A{
			bson.M{"alias": mcpAlias, "transport": "stdio", "toolName": "myTool"},
		},
		"rpc": bson.A{
			bson.M{"alias": rpcAlias, "protocol": "http"},
		},
	})

	repo := NewMongoRepository(db)
	ctx := context.Background()

	result, err := repo.FindByUserID(ctx, "user-with-integrations")

	require.NoError(t, err)
	require.NotNil(t, result)
	require.Len(t, result.MCP, 1)
	assert.Equal(t, mcpAlias, result.MCP[0].Alias)
	require.Len(t, result.RPC, 1)
	assert.Equal(t, rpcAlias, result.RPC[0].Alias)
}

func TestMongoRepository_FindByUserID_ContextCancellation(t *testing.T) {
	db, cleanup := setupTestDB(t)
	defer cleanup()

	repo := NewMongoRepository(db)

	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	result, err := repo.FindByUserID(canceledCtx, "any-user")

	assert.Error(t, err, "cancelled context must propagate as an error")
	assert.Nil(t, result)
}
