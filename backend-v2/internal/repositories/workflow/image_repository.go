package workflow

import (
	"backend-v2/internal/database"
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

/* ImageRepository handles WorkflowImage GridFS operations */
type ImageRepository interface {
	FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error)
}

type imageRepository struct {
	bucket *database.GridFSBucket
}

/* NewImageRepository creates repository with GridFS bucket */
func NewImageRepository(db *mongo.Database) (ImageRepository, error) {
	bucket, err := database.NewGridFSBucket(db, "WorkflowImage")
	if err != nil {
		return nil, err
	}

	return &imageRepository{bucket: bucket}, nil
}

/* FindByWorkflowID returns all images for a workflow */
func (r *imageRepository) FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error) {
	filter := bson.M{"metadata.workflowId": workflowID}
	return r.bucket.Find(ctx, filter)
}
