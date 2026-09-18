package workflow

import (
	"context"
	"errors"
	"testing"

	commonErrors "backend-v2/internal/common/errors"

	"github.com/stretchr/testify/require"
)

func TestWorkflowDeletionLifecycleStopsBeforeCleanupWhenAuthorizationFails(t *testing.T) {
	awaitCalled := false
	cleanupCalled := false
	finalizeCalled := false
	err := runWorkflowDeletionLifecycle(
		context.Background(),
		"wf-1",
		WorkflowAccess{},
		func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError {
			return commonErrors.NewHTTPError(403, "not owner")
		},
		func(context.Context, string) *commonErrors.HTTPError { awaitCalled = true; return nil },
		func(context.Context, string) error { cleanupCalled = true; return nil },
		func(context.Context, string) *commonErrors.HTTPError { finalizeCalled = true; return nil },
	)
	require.Equal(t, 403, err.Status)
	require.False(t, awaitCalled)
	require.False(t, cleanupCalled)
	require.False(t, finalizeCalled)
}

func TestWorkflowDeletionLifecycleKeepsTombstoneWhenCleanupFails(t *testing.T) {
	pending := false
	finalizeCalled := false
	err := runWorkflowDeletionLifecycle(
		context.Background(),
		"wf-1",
		WorkflowAccess{IsOwner: true},
		func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError { pending = true; return nil },
		func(context.Context, string) *commonErrors.HTTPError { return nil },
		func(context.Context, string) error { return errors.New("storage unavailable") },
		func(context.Context, string) *commonErrors.HTTPError {
			finalizeCalled = true
			pending = false
			return nil
		},
	)
	require.Equal(t, 500, err.Status)
	require.True(t, pending)
	require.False(t, finalizeCalled)
}

func TestWorkflowDeletionLifecycleKeepsTombstoneWhenFinalizationFails(t *testing.T) {
	pending := false
	filesDeleted := false
	err := runWorkflowDeletionLifecycle(
		context.Background(),
		"wf-1",
		WorkflowAccess{IsOwner: true},
		func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError { pending = true; return nil },
		func(context.Context, string) *commonErrors.HTTPError { return nil },
		func(context.Context, string) error { filesDeleted = true; return nil },
		func(context.Context, string) *commonErrors.HTTPError {
			return commonErrors.NewHTTPError(500, "database unavailable")
		},
	)
	require.Equal(t, 500, err.Status)
	require.True(t, pending)
	require.True(t, filesDeleted)
}

func TestWorkflowDeletionLifecycleRetainsTombstoneWhileUploadsAreActive(t *testing.T) {
	cleanupCalled := false
	finalizeCalled := false
	err := runWorkflowDeletionLifecycle(
		context.Background(),
		"wf-1",
		WorkflowAccess{IsOwner: true},
		func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError { return nil },
		func(context.Context, string) *commonErrors.HTTPError {
			return commonErrors.NewHTTPError(409, "uploads active")
		},
		func(context.Context, string) error { cleanupCalled = true; return nil },
		func(context.Context, string) *commonErrors.HTTPError { finalizeCalled = true; return nil },
	)
	require.Equal(t, 409, err.Status)
	require.False(t, cleanupCalled)
	require.False(t, finalizeCalled)
}

func TestWorkflowDeletionLifecycleFinalizesOnlyAfterUploadsDrainAndCleanup(t *testing.T) {
	steps := make([]string, 0, 4)
	err := runWorkflowDeletionLifecycle(
		context.Background(),
		"wf-1",
		WorkflowAccess{IsOwner: true},
		func(context.Context, string, WorkflowAccess) *commonErrors.HTTPError {
			steps = append(steps, "begin")
			return nil
		},
		func(context.Context, string) *commonErrors.HTTPError {
			steps = append(steps, "await-uploads")
			return nil
		},
		func(context.Context, string) error { steps = append(steps, "cleanup"); return nil },
		func(context.Context, string) *commonErrors.HTTPError {
			steps = append(steps, "finalize")
			return nil
		},
	)
	require.Nil(t, err)
	require.Equal(t, []string{"begin", "await-uploads", "cleanup", "finalize"}, steps)
}

func TestValidateWorkflowDeleteAccessRequiresOwner(t *testing.T) {
	require.Equal(t, 403, validateWorkflowDeleteAccess(WorkflowAccess{}).Status)
	require.Nil(t, validateWorkflowDeleteAccess(WorkflowAccess{IsOwner: true}))
}
