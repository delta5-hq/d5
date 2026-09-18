package workflow

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/mongo"
)

func workflowFileLookupStatus(t *testing.T, lookupErr error) int {
	t.Helper()
	app := fiber.New()
	app.Get("/", func(c *fiber.Ctx) error {
		return workflowFileLookupError(c, lookupErr)
	})
	response, err := app.Test(httptest.NewRequest(fiber.MethodGet, "/", nil))
	require.NoError(t, err)
	return response.StatusCode
}

func TestWorkflowFileLookupErrorTreatsOnlyMissingFileAsNotFound(t *testing.T) {
	require.Equal(t, fiber.StatusNotFound, workflowFileLookupStatus(t, mongo.ErrNoDocuments))
	require.Equal(t, fiber.StatusNotFound, workflowFileLookupStatus(t, errors.Join(errors.New("lookup"), mongo.ErrNoDocuments)))
}

func TestWorkflowFileLookupErrorDoesNotHideStorageFailureAsNotFound(t *testing.T) {
	require.Equal(t, fiber.StatusInternalServerError, workflowFileLookupStatus(t, errors.New("storage unavailable")))
}
