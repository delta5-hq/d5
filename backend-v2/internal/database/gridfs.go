package database

import (
	"context"
	"io"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"go.mongodb.org/mongo-driver/mongo/options"
)

/* GridFS bucket wrapper for file storage */
type GridFSBucket struct {
	bucket *gridfs.Bucket
}

/* NewGridFSBucket creates a GridFS bucket for a collection */
func NewGridFSBucket(db *mongo.Database, bucketName string) (*GridFSBucket, error) {
	bucket, err := gridfs.NewBucket(db, options.GridFSBucket().SetName(bucketName))
	if err != nil {
		return nil, err
	}

	return &GridFSBucket{bucket: bucket}, nil
}

/* Find files by metadata query */
func (g *GridFSBucket) Find(ctx context.Context, filter bson.M) ([]GridFSFile, error) {
	cursor, err := g.bucket.Find(filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	files := []GridFSFile{}
	for cursor.Next(ctx) {
		var file gridfs.File
		if err := cursor.Decode(&file); err != nil {
			continue
		}

		files = append(files, GridFSFile{
			ID:       file.ID.(primitive.ObjectID),
			Filename: file.Name,
			Length:   file.Length,
			Metadata: file.Metadata,
			bucket:   g.bucket,
		})
	}

	return files, nil
}

func (g *GridFSBucket) FindOne(ctx context.Context, filter bson.M) (*GridFSFile, error) {
	files, err := g.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, mongo.ErrNoDocuments
	}
	return &files[0], nil
}

func (g *GridFSBucket) UploadFromStream(ctx context.Context, filename string, reader io.Reader, metadata bson.M) (primitive.ObjectID, error) {
	uploadStream, err := g.bucket.OpenUploadStream(filename, options.GridFSUpload().SetMetadata(metadata))
	if err != nil {
		return primitive.NilObjectID, err
	}

	if _, err := io.Copy(uploadStream, reader); err != nil {
		_ = uploadStream.Abort()
		return primitive.NilObjectID, err
	}

	id, ok := uploadStream.FileID.(primitive.ObjectID)
	if !ok {
		_ = uploadStream.Abort()
		return primitive.NilObjectID, mongo.ErrNilDocument
	}

	if err := uploadStream.Close(); err != nil {
		_ = uploadStream.Abort()
		return primitive.NilObjectID, err
	}

	return id, nil
}

func (g *GridFSBucket) Delete(ctx context.Context, id primitive.ObjectID) error {
	return g.bucket.Delete(id)
}

/* GridFSFile represents a file in GridFS */
type GridFSFile struct {
	ID       primitive.ObjectID
	Filename string
	Length   int64
	Metadata bson.Raw
	bucket   *gridfs.Bucket
}

/* OpenDownloadStream returns reader for file content */
func (f *GridFSFile) OpenDownloadStream(ctx context.Context) (io.Reader, error) {
	return f.bucket.OpenDownloadStream(f.ID)
}

/* ToJSON converts file metadata to JSON-serializable map */
func (f *GridFSFile) ToJSON() map[string]interface{} {
	result := map[string]interface{}{
		"_id":      f.ID.Hex(),
		"filename": f.Filename,
		"length":   f.Length,
	}

	if f.Metadata != nil {
		var metadata bson.M
		if err := bson.Unmarshal(f.Metadata, &metadata); err == nil {
			result["metadata"] = metadata
		}
	}

	return result
}
