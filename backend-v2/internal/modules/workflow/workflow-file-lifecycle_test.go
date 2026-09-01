package workflow

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestReconcileUploadedWorkflowFileKeepsFileForActiveWorkflow(t *testing.T) {
	deleteCalls := 0
	err := reconcileUploadedWorkflowFile(
		context.Background(),
		"wf-1",
		"file-1",
		func(context.Context, string) error { return nil },
		func(context.Context, string) error { deleteCalls++; return nil },
	)
	require.Nil(t, err)
	require.Zero(t, deleteCalls)
}

func TestReconcileUploadedWorkflowFileCompensatesInactiveUpload(t *testing.T) {
	deleteCalls := 0
	err := reconcileUploadedWorkflowFile(
		context.Background(),
		"wf-1",
		"file-1",
		func(context.Context, string) error { return errors.New("not active") },
		func(context.Context, string) error { deleteCalls++; return nil },
	)
	require.Equal(t, 409, err.Status)
	require.Equal(t, 1, deleteCalls)
}

func TestReconcileUploadedWorkflowFileRetriesCompensation(t *testing.T) {
	deleteCalls := 0
	err := reconcileUploadedWorkflowFile(
		context.Background(),
		"wf-1",
		"file-1",
		func(context.Context, string) error { return errors.New("not active") },
		func(context.Context, string) error {
			deleteCalls++
			if deleteCalls < 3 {
				return errors.New("storage unavailable")
			}
			return nil
		},
	)
	require.Equal(t, 409, err.Status)
	require.Equal(t, 3, deleteCalls)
}

func TestReconcileUploadedWorkflowFileReportsPersistentCleanupFailure(t *testing.T) {
	deleteCalls := 0
	err := reconcileUploadedWorkflowFile(
		context.Background(),
		"wf-1",
		"file-1",
		func(context.Context, string) error { return errors.New("not active") },
		func(context.Context, string) error { deleteCalls++; return errors.New("storage unavailable") },
	)
	require.Equal(t, 500, err.Status)
	require.Equal(t, 3, deleteCalls)
}

func TestWorkflowKeyedMutexSerializesSameWorkflow(t *testing.T) {
	var locks workflowKeyedMutex
	releaseFirst := locks.acquire("wf-1")
	acquiredSecond := make(chan struct{})
	go func() {
		releaseSecond := locks.acquire("wf-1")
		close(acquiredSecond)
		releaseSecond()
	}()

	select {
	case <-acquiredSecond:
		t.Fatal("second operation crossed the same-workflow lifecycle boundary")
	case <-time.After(10 * time.Millisecond):
	}
	releaseFirst()
	select {
	case <-acquiredSecond:
	case <-time.After(time.Second):
		t.Fatal("second operation did not resume after lifecycle release")
	}
}
