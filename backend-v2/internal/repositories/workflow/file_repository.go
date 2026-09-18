package workflow

import (
	"backend-v2/internal/database"
	"context"
	"io"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

/* FileRepository handles WorkflowFile GridFS operations */
type FileRepository interface {
	FindByWorkflowID(ctx context.Context, workflowID string) ([]database.GridFSFile, error)
	FindByWorkflowIDAndFileID(ctx context.Context, workflowID string, fileID string) (*database.GridFSFile, error)
	Upload(ctx context.Context, workflowID string, userID string, filename string, reader io.Reader) (database.GridFSFile, error)
	Delete(ctx context.Context, id string) error
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

func (r *fileRepository) FindByWorkflowIDAndFileID(
	ctx context.Context,
	workflowID string,
	fileID string,
) (*database.GridFSFile, error) {
	objectID, err := primitive.ObjectIDFromHex(fileID)
	if err != nil {
		return nil, err
	}
	return r.bucket.FindOne(ctx, bson.M{
		"_id":                 objectID,
		"metadata.workflowId": workflowID,
	})
}

func (r *fileRepository) Upload(
	ctx context.Context,
	workflowID string,
	userID string,
	filename string,
	reader io.Reader,
) (database.GridFSFile, error) {
	id, err := r.bucket.UploadFromStream(ctx, filename, reader, bson.M{
		"workflowId": workflowID,
		"userId":     userID,
	})
	if err != nil {
		return database.GridFSFile{}, err
	}

	return database.GridFSFile{ID: id, Filename: filename}, nil
}

func (r *fileRepository) Delete(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}
	return r.bucket.Delete(ctx, objectID)
}
