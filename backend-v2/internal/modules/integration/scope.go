package integration

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
)

type ScopeIdentifier struct {
	UserID     string
	WorkflowID *string
}

func extractScopeFromRequest(c *fiber.Ctx, getUserID func(*fiber.Ctx) string) ScopeIdentifier {
	return ScopeIdentifier{
		UserID:     getUserID(c),
		WorkflowID: normalizeWorkflowID(c.Query("workflowId")),
	}
}

func normalizeWorkflowID(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func buildScopeFilter(scope ScopeIdentifier) bson.M {
	return bson.M{
		"userId":     scope.UserID,
		"workflowId": scope.WorkflowID,
	}
}
