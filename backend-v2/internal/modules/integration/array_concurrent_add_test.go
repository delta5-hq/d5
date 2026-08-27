//go:build integration
// +build integration

package integration

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"
)

func TestAddArrayItem_ScopeDocumentSingularity(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db, cleanup := setupCrossTypeTestDB(t)
	defer cleanup()

	t.Run("ConcurrentFirstWritesConvergeToOneDoc", func(t *testing.T) {
		userID := "singularity-concurrent"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		const goroutines = 30
		errs := make([]error, goroutines)
		var wg sync.WaitGroup
		wg.Add(goroutines)
		for i := 0; i < goroutines; i++ {
			go func(idx int) {
				defer wg.Done()
				errs[idx] = svc.AddArrayItem(context.Background(), scope, "mcp",
					newMCPItem(fmt.Sprintf("/t%d", idx)))
			}(i)
		}
		wg.Wait()

		if countSuccesses(errs) != goroutines {
			t.Errorf("all %d distinct-alias adds should succeed", goroutines)
		}
		assertExactlyScopeDocCount(t, db, scope, 1)
		assertAliasUniquenessInScope(t, db, scope)
	})

	t.Run("NullWorkflowScopeIndexedAsSingleKey", func(t *testing.T) {
		userID := "singularity-null-wf"
		cleanupTestIntegrations(t, db, userID)
		nullScope := ScopeIdentifier{UserID: userID, WorkflowID: nil}
		wfID := "wf-non-null"
		wfScope := ScopeIdentifier{UserID: userID, WorkflowID: &wfID}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		const goroutines = 10
		var wg sync.WaitGroup
		wg.Add(goroutines)
		for i := 0; i < goroutines; i++ {
			go func(idx int) {
				defer wg.Done()
				_ = svc.AddArrayItem(context.Background(), nullScope, "mcp",
					newMCPItem(fmt.Sprintf("/null%d", idx)))
			}(i)
		}
		wg.Wait()

		assertExactlyScopeDocCount(t, db, nullScope, 1)

		if err := svc.AddArrayItem(context.Background(), wfScope, "rpc", newRPCItem("/wf-tool")); err != nil {
			t.Fatalf("wf-scope add failed: %v", err)
		}

		assertExactlyScopeDocCount(t, db, wfScope, 1)
		assertExactlyScopeDocCount(t, db, nullScope, 1)
	})

	t.Run("DistinctWorkflowScopesAreIndependent", func(t *testing.T) {
		userID := "singularity-multi-scope"
		cleanupTestIntegrations(t, db, userID)
		wfA, wfB := "scope-A", "scope-B"
		scopeA := ScopeIdentifier{UserID: userID, WorkflowID: &wfA}
		scopeB := ScopeIdentifier{UserID: userID, WorkflowID: &wfB}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		const perScope = 10
		errs := make([]error, perScope*2)
		var wg sync.WaitGroup
		wg.Add(perScope * 2)
		for i := 0; i < perScope; i++ {
			go func(idx int) {
				defer wg.Done()
				errs[idx] = svc.AddArrayItem(context.Background(), scopeA, "mcp",
					newMCPItem(fmt.Sprintf("/a%d", idx)))
			}(i)
			go func(idx int) {
				defer wg.Done()
				errs[perScope+idx] = svc.AddArrayItem(context.Background(), scopeB, "rpc",
					newRPCItem(fmt.Sprintf("/b%d", idx)))
			}(i)
		}
		wg.Wait()

		if countSuccesses(errs) != perScope*2 {
			t.Errorf("all distinct cross-scope adds should succeed, got %d/%d successes",
				countSuccesses(errs), perScope*2)
		}
		assertExactlyScopeDocCount(t, db, scopeA, 1)
		assertExactlyScopeDocCount(t, db, scopeB, 1)
		assertScopeArrayLen(t, db, scopeA, "mcp", perScope)
		assertScopeArrayLen(t, db, scopeA, "rpc", 0)
		assertScopeArrayLen(t, db, scopeB, "rpc", perScope)
		assertScopeArrayLen(t, db, scopeB, "mcp", 0)
	})
}

func TestAddArrayItem_AliasUniquenessUnderConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db, cleanup := setupCrossTypeTestDB(t)
	defer cleanup()

	t.Run("SameFieldSameAliasExactlyOneSucceeds", func(t *testing.T) {
		userID := "uniqueness-same-field"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		const goroutines = 20
		errs := make([]error, goroutines)
		var wg sync.WaitGroup
		wg.Add(goroutines)
		for i := 0; i < goroutines; i++ {
			go func(idx int) {
				defer wg.Done()
				errs[idx] = svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/dup"))
			}(i)
		}
		wg.Wait()

		if s := countSuccesses(errs); s != 1 {
			t.Errorf("exactly 1 writer should succeed for same-alias same-field race, got %d", s)
		}
		assertExactlyScopeDocCount(t, db, scope, 1)
		assertScopeArrayLen(t, db, scope, "mcp", 1)
	})

	t.Run("CrossTypeSameAliasAtMostOneSucceeds", func(t *testing.T) {
		// The $ne filter spans all array types, so at most one writer wins.
		userID := "uniqueness-cross-type"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		var mcpErr, rpcErr error
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			mcpErr = svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/shared"))
		}()
		go func() {
			defer wg.Done()
			rpcErr = svc.AddArrayItem(context.Background(), scope, "rpc", newRPCItem("/shared"))
		}()
		wg.Wait()

		if mcpErr == nil && rpcErr == nil {
			t.Error("both mcp and rpc succeeded for the same alias — cross-type alias uniqueness violated")
		}
		assertExactlyScopeDocCount(t, db, scope, 1)
		assertAliasUniquenessInScope(t, db, scope)
	})

	t.Run("MixedFieldTypesDistinctAliasesAllSucceed", func(t *testing.T) {
		userID := "uniqueness-mixed-types"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		const perType = 15
		errs := make([]error, perType*2)
		var wg sync.WaitGroup
		wg.Add(perType * 2)
		for i := 0; i < perType; i++ {
			go func(idx int) {
				defer wg.Done()
				errs[idx] = svc.AddArrayItem(context.Background(), scope, "mcp",
					newMCPItem(fmt.Sprintf("/m%d", idx)))
			}(i)
			go func(idx int) {
				defer wg.Done()
				errs[perType+idx] = svc.AddArrayItem(context.Background(), scope, "rpc",
					newRPCItem(fmt.Sprintf("/r%d", idx)))
			}(i)
		}
		wg.Wait()

		if s := countSuccesses(errs); s != perType*2 {
			t.Errorf("all %d mixed-type distinct-alias adds should succeed, got %d", perType*2, s)
		}
		assertExactlyScopeDocCount(t, db, scope, 1)
		assertScopeArrayLen(t, db, scope, "mcp", perType)
		assertScopeArrayLen(t, db, scope, "rpc", perType)
		assertAliasUniquenessInScope(t, db, scope)
	})
}

func TestAddArrayItem_InputContracts(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db, cleanup := setupCrossTypeTestDB(t)
	defer cleanup()

	svc, err := NewService(db)
	if err != nil {
		t.Fatalf("NewService: %v", err)
	}

	scope := ScopeIdentifier{UserID: "input-contracts", WorkflowID: nil}
	cleanupTestIntegrations(t, db, scope.UserID)

	t.Run("RejectsEmptyAlias", func(t *testing.T) {
		item := newMCPItem("")
		err := svc.AddArrayItem(context.Background(), scope, "mcp", item)
		if err == nil {
			t.Fatal("expected error for empty alias, got nil")
		}
		if err.Error() != "alias is required" {
			t.Errorf("error message: want %q, got %q", "alias is required", err.Error())
		}
	})

	t.Run("RejectsMissingAliasField", func(t *testing.T) {
		item := map[string]interface{}{
			"transport": "stdio",
			"command":   "npx",
			"toolName":  "test",
		}
		err := svc.AddArrayItem(context.Background(), scope, "mcp", item)
		if err == nil {
			t.Fatal("expected error for missing alias field, got nil")
		}
		if err.Error() != "alias is required" {
			t.Errorf("error message: want %q, got %q", "alias is required", err.Error())
		}
	})

	t.Run("RejectsSentinelSecretOnEncryptedField", func(t *testing.T) {
		item := map[string]interface{}{
			"alias":           "/sentinel-test",
			"protocol":        "ssh",
			"host":            "localhost",
			"username":        "user",
			"privateKey":      SecretRedactionSentinel,
			"commandTemplate": "cmd",
		}
		err := svc.AddArrayItem(context.Background(), scope, "rpc", item)
		if err == nil {
			t.Fatal("expected error for sentinel secret on create, got nil")
		}
		if err.Error() != "invalid secret value for field 'privateKey': sentinel value not allowed on creation" {
			t.Errorf("unexpected error: %v", err)
		}
		assertExactlyScopeDocCount(t, db, scope, 0)
	})
}

func TestDeleteArrayItem_ScopeCleanup(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test")
	}

	db, cleanup := setupCrossTypeTestDB(t)
	defer cleanup()

	t.Run("LastItemDeletedRemovesScopeDocument", func(t *testing.T) {
		userID := "cleanup-last-item"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		if err := svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/only")); err != nil {
			t.Fatalf("add: %v", err)
		}
		assertExactlyScopeDocCount(t, db, scope, 1)

		if err := svc.DeleteArrayItem(context.Background(), scope, "mcp", "/only"); err != nil {
			t.Fatalf("delete: %v", err)
		}
		assertExactlyScopeDocCount(t, db, scope, 0)
	})

	t.Run("DeletePreservesScopeWhenOtherArrayHasItems", func(t *testing.T) {
		userID := "cleanup-other-array"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		if err := svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/m")); err != nil {
			t.Fatalf("add mcp: %v", err)
		}
		if err := svc.AddArrayItem(context.Background(), scope, "rpc", newRPCItem("/r")); err != nil {
			t.Fatalf("add rpc: %v", err)
		}

		if err := svc.DeleteArrayItem(context.Background(), scope, "mcp", "/m"); err != nil {
			t.Fatalf("delete mcp: %v", err)
		}

		assertExactlyScopeDocCount(t, db, scope, 1)
		assertScopeArrayLen(t, db, scope, "rpc", 1)
		assertScopeArrayLen(t, db, scope, "mcp", 0)
	})

	t.Run("DeletedScopeIsRecreatedBySubsequentAdd", func(t *testing.T) {
		userID := "cleanup-recreate"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		if err := svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/first")); err != nil {
			t.Fatalf("add: %v", err)
		}
		if err := svc.DeleteArrayItem(context.Background(), scope, "mcp", "/first"); err != nil {
			t.Fatalf("delete: %v", err)
		}
		assertExactlyScopeDocCount(t, db, scope, 0)

		if err := svc.AddArrayItem(context.Background(), scope, "rpc", newRPCItem("/second")); err != nil {
			t.Fatalf("re-add after scope removal: %v", err)
		}
		assertExactlyScopeDocCount(t, db, scope, 1)
		assertScopeArrayLen(t, db, scope, "rpc", 1)
	})

	t.Run("ConcurrentAddWithConcurrentDeletePreservesAtomicity", func(t *testing.T) {
		// Races a bulk-delete against many concurrent adds to a different array field.
		// The atomic conditional-remove must not delete the scope doc while any
		// concurrent add has already pushed an item to another field.
		userID := "cleanup-delete-add-race"
		cleanupTestIntegrations(t, db, userID)
		scope := ScopeIdentifier{UserID: userID, WorkflowID: nil}

		svc, err := NewService(db)
		if err != nil {
			t.Fatalf("NewService: %v", err)
		}

		if err := svc.AddArrayItem(context.Background(), scope, "mcp", newMCPItem("/seed")); err != nil {
			t.Fatalf("seed mcp[/seed]: %v", err)
		}

		const racers = 20
		addErrors := make([]error, racers)
		var wg sync.WaitGroup
		wg.Add(racers + 1)

		go func() {
			defer wg.Done()
			_ = svc.DeleteArrayItem(context.Background(), scope, "mcp", "/seed")
		}()
		for i := 0; i < racers; i++ {
			go func(idx int) {
				defer wg.Done()
				addErrors[idx] = svc.AddArrayItem(context.Background(), scope, "rpc",
					newRPCItem("/seed"))
			}(i)
		}
		wg.Wait()

		for _, err := range addErrors {
			if err != nil && !strings.Contains(err.Error(), "field '") {
				t.Errorf("unexpected error shape (must identify colliding field): %v", err)
			}
		}
		if countSuccesses(addErrors) > 1 {
			t.Errorf("at most one concurrent rpc add should succeed, got %d", countSuccesses(addErrors))
		}
		assertAliasUniquenessInScope(t, db, scope)
	})
}
