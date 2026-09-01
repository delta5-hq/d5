package workflow

import (
	"context"
	"sync"

	commonErrors "backend-v2/internal/common/errors"
)

type workflowLockEntry struct {
	mu   sync.Mutex
	refs int
}

// workflowKeyedMutex serializes file creation/removal with aggregate deletion
// for one workflow without blocking unrelated workflows in the same process.
type workflowKeyedMutex struct {
	mu      sync.Mutex
	entries map[string]*workflowLockEntry
}

func (m *workflowKeyedMutex) acquire(workflowID string) func() {
	m.mu.Lock()
	if m.entries == nil {
		m.entries = make(map[string]*workflowLockEntry)
	}
	entry := m.entries[workflowID]
	if entry == nil {
		entry = &workflowLockEntry{}
		m.entries[workflowID] = entry
	}
	entry.refs++
	m.mu.Unlock()

	entry.mu.Lock()
	return func() {
		entry.mu.Unlock()
		m.mu.Lock()
		entry.refs--
		if entry.refs == 0 {
			delete(m.entries, workflowID)
		}
		m.mu.Unlock()
	}
}

type workflowActiveLookupFn func(context.Context, string) error
type deleteUploadedWorkflowFileFn func(context.Context, string) error

// reconcileUploadedWorkflowFile closes the cross-instance race where an upload
// was admitted before deletion but finished after the aggregate became pending.
func reconcileUploadedWorkflowFile(
	ctx context.Context,
	workflowID string,
	fileID string,
	lookupActive workflowActiveLookupFn,
	deleteFile deleteUploadedWorkflowFileFn,
) *commonErrors.HTTPError {
	if err := lookupActive(ctx, workflowID); err == nil {
		return nil
	}

	for attempt := 0; attempt < 3; attempt++ {
		if err := deleteFile(ctx, fileID); err == nil {
			return commonErrors.NewHTTPError(409, "Workflow became inactive during file upload")
		}
	}
	return commonErrors.NewHTTPError(500, "Workflow became inactive and uploaded file cleanup failed")
}
