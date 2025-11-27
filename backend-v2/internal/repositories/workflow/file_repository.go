package workflow

import (
	"backend-v2/internal/database"
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/* FileRepository handles WorkflowFile GridFS operations */
type FileRepository interface {
	FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error)
}

type fileRepository struct {
	bucket *database.GridFSBucket
}

/* NewFileRepository creates repository with GridFS bucket */
func NewFileRepository(db *mongo.Database) (FileRepository, error) {
	bucket, err := database.NewGridFSBucket(db, "WorkflowFile")
	if err != nil {
		return nil, err
	}

	return &fileRepository{bucket: bucket}, nil
}

/* FindByWorkflowID returns all files for a workflow */
func (r *fileRepository) FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error) {
	filter := bson.M{"metadata.workflowId": workflowID}
	return r.bucket.Find(ctx, filter)
}
