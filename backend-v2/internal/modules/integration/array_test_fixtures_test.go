//go:build integration
// +build integration

package integration

import (
	"context"
	"testing"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

func newMCPItem(alias string) map[string]interface{} {
	return map[string]interface{}{
		"alias":     alias,
		"transport": "stdio",
		"command":   "npx",
		"toolName":  "test",
	}
}

func newRPCItem(alias string) map[string]interface{} {
	return map[string]interface{}{
		"alias":           alias,
		"protocol":        "ssh",
		"host":            "localhost",
		"username":        "testuser",
		"privateKey":      "key123",
		"commandTemplate": "test {{prompt}}",
	}
}

func assertExactlyScopeDocCount(t *testing.T, db *qmgo.Database, scope ScopeIdentifier, want int) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	count, err := db.Collection("integrations").Find(ctx, buildScopeFilter(scope)).Count()
	if err != nil {
		t.Fatalf("assertExactlyScopeDocCount: query failed: %v", err)
	}
	if int(count) != want {
		t.Errorf("scope doc count: want %d, got %d", want, count)
	}
}

// Summing across all scope documents catches split-doc regressions where items
// land in two documents instead of one.
func assertScopeArrayLen(t *testing.T, db *qmgo.Database, scope ScopeIdentifier, field string, want int) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var docs []bson.M
	if err := db.Collection("integrations").Find(ctx, buildScopeFilter(scope)).All(&docs); err != nil {
		t.Fatalf("assertScopeArrayLen(%q): query failed: %v", field, err)
	}

	total := 0
	for _, doc := range docs {
		arr, _ := doc[field].(bson.A)
		total += len(arr)
	}
	if total != want {
		t.Errorf("field %q item count across scope: want %d, got %d", field, want, total)
	}
}

func assertAliasUniquenessInScope(t *testing.T, db *qmgo.Database, scope ScopeIdentifier) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var docs []bson.M
	if err := db.Collection("integrations").Find(ctx, buildScopeFilter(scope)).All(&docs); err != nil {
		t.Fatalf("assertAliasUniquenessInScope: query failed: %v", err)
	}

	type location struct {
		field    string
		docIndex int
	}
	seen := make(map[string]location)

	for docIndex, doc := range docs {
		for field := range registeredArrayFields {
			arr, _ := doc[field].(bson.A)
			for _, raw := range arr {
				item, _ := raw.(bson.M)
				alias, _ := item["alias"].(string)
				if alias == "" {
					continue
				}
				if prev, exists := seen[alias]; exists {
					t.Errorf("alias %q duplicated: first at field=%s doc=%d, again at field=%s doc=%d",
						alias, prev.field, prev.docIndex, field, docIndex)
				}
				seen[alias] = location{field: field, docIndex: docIndex}
			}
		}
	}
}

func countSuccesses(errs []error) int {
	n := 0
	for _, err := range errs {
		if err == nil {
			n++
		}
	}
	return n
}
