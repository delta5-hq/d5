package models

import (
	"context"

	"backend-v2/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/* WorkflowFileRepository handles WorkflowFile GridFS operations */
type WorkflowFileRepository struct {
	bucket *database.GridFSBucket
}

/* NewWorkflowFileRepository creates repository with GridFS bucket */
func NewWorkflowFileRepository(db *mongo.Database) (*WorkflowFileRepository, error) {
	bucket, err := database.NewGridFSBucket(db, "WorkflowFile")
	if err != nil {
		return nil, err
	}

	return &WorkflowFileRepository{bucket: bucket}, nil
}

/* FindByWorkflowID returns all files for a workflow */
func (r *WorkflowFileRepository) FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error) {
	filter := bson.M{"metadata.workflowId": workflowID}
	return r.bucket.Find(ctx, filter)
}
