package models

import (
	"context"

	"backend-v2/internal/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/* WorkflowImageRepository handles WorkflowImage GridFS operations */
type WorkflowImageRepository struct {
	bucket *database.GridFSBucket
}

/* NewWorkflowImageRepository creates repository with GridFS bucket */
func NewWorkflowImageRepository(db *mongo.Database) (*WorkflowImageRepository, error) {
	bucket, err := database.NewGridFSBucket(db, "WorkflowImage")
	if err != nil {
		return nil, err
	}

	return &WorkflowImageRepository{bucket: bucket}, nil
}

/* FindByWorkflowID returns all images for a workflow */
func (r *WorkflowImageRepository) FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error) {
	filter := bson.M{"metadata.workflowId": workflowID}
	return r.bucket.Find(ctx, filter)
}
