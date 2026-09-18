package workflow

import (
	"context"

	commonErrors "backend-v2/internal/common/errors"
)

type beginWorkflowDeletionFn func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError
type awaitWorkflowUploadsFn func(context.Context, string) *commonErrors.HTTPError
type cleanupWorkflowFilesFn func(context.Context, string) error
type finalizeWorkflowDeletionFn func(context.Context, string) *commonErrors.HTTPError

// runWorkflowDeletionLifecycle crosses the irreversible resource boundary only
// after authorization and a durable, hidden tombstone make every later failure
// retryable. Finalization is last, so a failure never restores live file links.
func runWorkflowDeletionLifecycle(
	ctx context.Context,
	workflowID string,
	access WorkflowAccess,
	begin beginWorkflowDeletionFn,
	awaitUploads awaitWorkflowUploadsFn,
	cleanup cleanupWorkflowFilesFn,
	finalize finalizeWorkflowDeletionFn,
) *commonErrors.HTTPError {
	if err := begin(ctx, workflowID, access); err != nil {
		return err
	}
	if err := awaitUploads(ctx, workflowID); err != nil {
		return err
	}
	if err := cleanup(ctx, workflowID); err != nil {
		return commonErrors.NewHTTPError(500, "Workflow file cleanup failed")
	}
	return finalize(ctx, workflowID)
}
