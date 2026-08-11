package workflow

import (
	"context"
	"errors"
	"fmt"

	"backend-v2/internal/database"
)

type workflowFileCleaner interface {
	FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error)
	Delete(ctx context.Context, id string) error
}

// deleteWorkflowFiles removes every uploaded file owned by a deleted workflow.
// It attempts the whole set so one storage error cannot strand later files.
func deleteWorkflowFiles(ctx context.Context, repo workflowFileCleaner, workflowID string) error {
	files, err := repo.FindByWorkflowID(ctx, workflowID)
	if err != nil {
		return fmt.Errorf("list workflow files: %w", err)
	}

	var cleanupErrors []error
	for _, file := range files {
		if err := repo.Delete(ctx, file.ID.Hex()); err != nil {
			cleanupErrors = append(cleanupErrors, fmt.Errorf("delete workflow file %s: %w", file.ID.Hex(), err))
		}
	}
	return errors.Join(cleanupErrors...)
}
