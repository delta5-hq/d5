//go:build integration
// +build integration

package integration

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

func setupCrossTypeTestDB(t *testing.T) (*qmgo.Database, func()) {
	t.Helper()

	uri := os.Getenv("TEST_MONGO_URI")
	if uri == "" {
		uri = "mongodb://localhost:27018/delta5_cross_type_test"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := qmgo.NewClient(ctx, &qmgo.Config{Uri: uri})
	if err != nil {
		t.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	db := client.Database("delta5_cross_type_test")

	cleanup := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = db.DropCollection(ctx, "integrations")
		client.Close(ctx)
	}

	return db, cleanup
}

func cleanupTestIntegrations(t *testing.T, db *qmgo.Database, userID string) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, _ = db.Collection("integrations").RemoveAll(ctx, bson.M{"userId": userID})
}

func TestCrossTypeAliasValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	ctx := context.Background()
	db, cleanup := setupCrossTypeTestDB(t)
	defer cleanup()

	service, err := NewService(db)
	if err != nil {
		t.Fatalf("Failed to create service: %v", err)
	}

	scope := ScopeIdentifier{
		UserID:     "test-user-cross-type",
		WorkflowID: nil,
	}

	t.Run("RejectMCPWhenRPCExists", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		rpcItem := map[string]interface{}{
			"alias":           "/qa",
			"protocol":        "ssh",
			"host":            "localhost",
			"username":        "testuser",
			"privateKey":      "key123",
			"commandTemplate": "test {{prompt}}",
		}

		err := service.AddArrayItem(ctx, scope, "rpc", rpcItem)
		if err != nil {
			t.Fatalf("Failed to add RPC item: %v", err)
		}

		mcpItem := map[string]interface{}{
			"alias":     "/qa",
			"transport": "stdio",
			"command":   "npx",
			"toolName":  "test",
		}

		err = service.AddArrayItem(ctx, scope, "mcp", mcpItem)
		if err == nil {
			t.Fatal("Expected error when adding MCP with alias that exists in RPC, got nil")
		}

		errMsg := err.Error()
		if !strings.Contains(errMsg, "already exists in field") {
			t.Errorf("Expected error to contain 'already exists in field', got: %v", err)
		}
		if !strings.Contains(errMsg, "rpc") {
			t.Errorf("Expected error to reference 'rpc' field, got: %v", err)
		}
	})

	t.Run("RejectRPCWhenMCPExists", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		mcpItem := map[string]interface{}{
			"alias":     "/agent",
			"transport": "stdio",
			"command":   "claude",
			"toolName":  "chat",
		}

		err := service.AddArrayItem(ctx, scope, "mcp", mcpItem)
		if err != nil {
			t.Fatalf("Failed to add MCP item: %v", err)
		}

		rpcItem := map[string]interface{}{
			"alias":           "/agent",
			"protocol":        "http",
			"url":             "http://localhost:8080",
			"method":          "POST",
			"commandTemplate": "{{prompt}}",
		}

		err = service.AddArrayItem(ctx, scope, "rpc", rpcItem)
		if err == nil {
			t.Fatal("Expected error when adding RPC with alias that exists in MCP, got nil")
		}

		errMsg := err.Error()
		if !strings.Contains(errMsg, "already exists in field") {
			t.Errorf("Expected error to contain 'already exists in field', got: %v", err)
		}
		if !strings.Contains(errMsg, "mcp") {
			t.Errorf("Expected error to reference 'mcp' field, got: %v", err)
		}
	})

	t.Run("AllowSameAliasInDifferentScopes", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		userScope := ScopeIdentifier{
			UserID:     "test-user-cross-type",
			WorkflowID: nil,
		}

		mcpItem := map[string]interface{}{
			"alias":     "/tool",
			"transport": "stdio",
			"command":   "cmd",
			"toolName":  "test",
		}

		err := service.AddArrayItem(ctx, userScope, "mcp", mcpItem)
		if err != nil {
			t.Fatalf("Failed to add user-level MCP: %v", err)
		}

		workflowID := "wf-123"
		workflowScope := ScopeIdentifier{
			UserID:     "test-user-cross-type",
			WorkflowID: &workflowID,
		}

		rpcItem := map[string]interface{}{
			"alias":           "/tool",
			"protocol":        "ssh",
			"host":            "example.com",
			"username":        "user",
			"privateKey":      "key",
			"commandTemplate": "cmd",
		}

		err = service.AddArrayItem(ctx, workflowScope, "rpc", rpcItem)
		if err != nil {
			t.Errorf("Should allow same alias in different scope, got error: %v", err)
		}
	})

	t.Run("AllowDifferentAliasesCrossType", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		mcpItem := map[string]interface{}{
			"alias":     "/mcp-unique",
			"transport": "stdio",
			"command":   "cmd",
			"toolName":  "test",
		}

		err := service.AddArrayItem(ctx, scope, "mcp", mcpItem)
		if err != nil {
			t.Fatalf("Failed to add MCP: %v", err)
		}

		rpcItem := map[string]interface{}{
			"alias":           "/rpc-unique",
			"protocol":        "http",
			"url":             "http://localhost",
			"method":          "POST",
			"commandTemplate": "{{prompt}}",
		}

		err = service.AddArrayItem(ctx, scope, "rpc", rpcItem)
		if err != nil {
			t.Errorf("Should allow different aliases across types, got error: %v", err)
		}
	})

	t.Run("MultipleItemsSameType_EnforceCrossTypeUniqueness", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		// Add multiple MCP items
		for i := 1; i <= 3; i++ {
			mcpItem := map[string]interface{}{
				"alias":     "/mcp" + string(rune('0'+i)),
				"transport": "stdio",
				"command":   "cmd",
				"toolName":  "test",
			}
			if err := service.AddArrayItem(ctx, scope, "mcp", mcpItem); err != nil {
				t.Fatalf("Failed to add MCP item %d: %v", i, err)
			}
		}

		// Attempt to add RPC with alias matching ANY of the MCP items
		rpcItem := map[string]interface{}{
			"alias":           "/mcp2",
			"protocol":        "ssh",
			"host":            "example.com",
			"username":        "user",
			"privateKey":      "key",
			"commandTemplate": "cmd",
		}

		err := service.AddArrayItem(ctx, scope, "rpc", rpcItem)
		if err == nil {
			t.Error("Should reject RPC alias that matches any MCP alias, got success")
		}
		if err != nil && !strings.Contains(err.Error(), "already exists in field") {
			t.Errorf("Error should mention 'already exists in field', got: %v", err)
		}
	})

	t.Run("ValidationOrderPreservation", func(t *testing.T) {
		cleanupTestIntegrations(t, db, scope.UserID)

		// Add MCP item
		mcpItem := map[string]interface{}{
			"alias":     "/shared",
			"transport": "stdio",
			"command":   "cmd",
			"toolName":  "test",
		}
		if err := service.AddArrayItem(ctx, scope, "mcp", mcpItem); err != nil {
			t.Fatalf("Failed to add MCP: %v", err)
		}

		// Same-field validation should fire before cross-type validation
		mcpDuplicate := map[string]interface{}{
			"alias":     "/shared",
			"transport": "sse",
			"serverUrl": "http://localhost",
			"toolName":  "test2",
		}

		err := service.AddArrayItem(ctx, scope, "mcp", mcpDuplicate)
		if err == nil {
			t.Fatal("Expected error for same-field duplicate, got nil")
		}
		if !strings.Contains(err.Error(), "already exists in field 'mcp'") {
			t.Errorf("Expected same-field error, got: %v", err)
		}
	})

	t.Run("DifferentUsersIndependentValidation", func(t *testing.T) {
		user1ID := "user1-cross-type"
		user2ID := "user2-cross-type"
		cleanupTestIntegrations(t, db, user1ID)
		cleanupTestIntegrations(t, db, user2ID)

		user1Scope := ScopeIdentifier{UserID: user1ID, WorkflowID: nil}
		user2Scope := ScopeIdentifier{UserID: user2ID, WorkflowID: nil}

		// User 1: Add MCP with /tool
		mcp1 := map[string]interface{}{
			"alias":     "/tool",
			"transport": "stdio",
			"command":   "cmd",
			"toolName":  "test",
		}
		if err := service.AddArrayItem(ctx, user1Scope, "mcp", mcp1); err != nil {
			t.Fatalf("User 1 MCP failed: %v", err)
		}

		// User 2: Should be able to add RPC with same /tool alias
		// (different user, so no cross-type collision)
		rpc2 := map[string]interface{}{
			"alias":           "/tool",
			"protocol":        "ssh",
			"host":            "example.com",
			"username":        "user",
			"privateKey":      "key",
			"commandTemplate": "cmd",
		}
		if err := service.AddArrayItem(ctx, user2Scope, "rpc", rpc2); err != nil {
			t.Errorf("User 2 should be able to use same alias as User 1, got error: %v", err)
		}

		// But User 2 should NOT be able to add MCP with same /tool alias
		// (same user, cross-type collision)
		mcp2 := map[string]interface{}{
			"alias":     "/tool",
			"transport": "sse",
			"serverUrl": "http://localhost",
			"toolName":  "test",
		}
		err := service.AddArrayItem(ctx, user2Scope, "mcp", mcp2)
		if err == nil {
			t.Error("User 2 should not be able to add MCP with same alias as their RPC")
		}
	})

	t.Run("ComplexScopeIsolation", func(t *testing.T) {
		userID := "user-scope-isolation"
		cleanupTestIntegrations(t, db, userID)

		// Setup: User-level MCP /qa
		userScope := ScopeIdentifier{UserID: userID, WorkflowID: nil}
		mcpUser := map[string]interface{}{
			"alias":     "/qa",
			"transport": "stdio",
			"command":   "cmd",
			"toolName":  "test",
		}
		if err := service.AddArrayItem(ctx, userScope, "mcp", mcpUser); err != nil {
			t.Fatalf("Failed to add user-level MCP: %v", err)
		}

		wf1 := "workflow-1"
		wf2 := "workflow-2"
		wf1Scope := ScopeIdentifier{UserID: userID, WorkflowID: &wf1}
		wf2Scope := ScopeIdentifier{UserID: userID, WorkflowID: &wf2}

		// Workflow 1: Add RPC /qa (should succeed - different scope from user-level MCP)
		rpcWf1 := map[string]interface{}{
			"alias":           "/qa",
			"protocol":        "ssh",
			"host":            "wf1.example.com",
			"username":        "user",
			"privateKey":      "key",
			"commandTemplate": "cmd",
		}
		if err := service.AddArrayItem(ctx, wf1Scope, "rpc", rpcWf1); err != nil {
			t.Errorf("Workflow 1 RPC should succeed (different scope), got: %v", err)
		}

		// Workflow 1: Add MCP /qa (should fail - same scope as RPC /qa)
		mcpWf1 := map[string]interface{}{
			"alias":     "/qa",
			"transport": "sse",
			"serverUrl": "http://localhost",
			"toolName":  "test",
		}
		err := service.AddArrayItem(ctx, wf1Scope, "mcp", mcpWf1)
		if err == nil {
			t.Error("Workflow 1 MCP should fail (cross-type collision in same scope)")
		}

		// Workflow 2: Add MCP /qa (should succeed - different scope from wf1)
		mcpWf2 := map[string]interface{}{
			"alias":     "/qa",
			"transport": "stdio",
			"command":   "cmd2",
			"toolName":  "test2",
		}
		if err := service.AddArrayItem(ctx, wf2Scope, "mcp", mcpWf2); err != nil {
			t.Errorf("Workflow 2 MCP should succeed (different scope from wf1), got: %v", err)
		}
	})
}
