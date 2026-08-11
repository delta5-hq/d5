package database

import (
	"context"
	"fmt"
	"io"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"go.mongodb.org/mongo-driver/mongo/options"
)

/* GridFS bucket wrapper for file storage */
type GridFSBucket struct {
	bucket     *gridfs.Bucket
	filesColl  gridFSDeleteCollection
	chunksColl gridFSDeleteCollection
}

type gridFSDeleteCollection interface {
	DeleteOne(context.Context, interface{}, ...*options.DeleteOptions) (*mongo.DeleteResult, error)
	DeleteMany(context.Context, interface{}, ...*options.DeleteOptions) (*mongo.DeleteResult, error)
}

type gridFSFileCursor interface {
	Next(context.Context) bool
	Decode(interface{}) error
	Err() error
	Close(context.Context) error
}

/* NewGridFSBucket creates a GridFS bucket for a collection */
func NewGridFSBucket(db *mongo.Database, bucketName string) (*GridFSBucket, error) {
	bucket, err := gridfs.NewBucket(db, options.GridFSBucket().SetName(bucketName))
	if err != nil {
		return nil, err
	}

	return &GridFSBucket{
		bucket:     bucket,
		filesColl:  db.Collection(bucketName + ".files"),
		chunksColl: db.Collection(bucketName + ".chunks"),
	}, nil
}

/* Find files by metadata query */
func (g *GridFSBucket) Find(ctx context.Context, filter bson.M) ([]GridFSFile, error) {
	cursor, err := g.bucket.Find(filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	return collectGridFSFiles(ctx, cursor, g.bucket)
}

func collectGridFSFiles(ctx context.Context, cursor gridFSFileCursor, bucket *gridfs.Bucket) ([]GridFSFile, error) {
	files := []GridFSFile{}
	for cursor.Next(ctx) {
		var file gridfs.File
		if err := cursor.Decode(&file); err != nil {
			return nil, fmt.Errorf("decode GridFS file: %w", err)
		}
		id, ok := file.ID.(primitive.ObjectID)
		if !ok {
			return nil, fmt.Errorf("decode GridFS file id: expected ObjectID, got %T", file.ID)
		}

		files = append(files, GridFSFile{
			ID:       id,
			Filename: file.Name,
			Length:   file.Length,
			Metadata: file.Metadata,
			bucket:   bucket,
		})
	}
	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("iterate GridFS files: %w", err)
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
	// Delete chunks first. If that fails, the metadata document remains
	// enumerable and aggregate cleanup can retry. Deleting metadata first (the
	// mongo-driver default) can strand chunks under an ID no later scan can see.
	chunkResult, err := g.chunksColl.DeleteMany(ctx, bson.M{"files_id": id})
	if err != nil {
		return fmt.Errorf("delete GridFS chunks: %w", err)
	}
	fileResult, err := g.filesColl.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return fmt.Errorf("delete GridFS metadata: %w", err)
	}
	if chunkResult.DeletedCount == 0 && fileResult.DeletedCount == 0 {
		return gridfs.ErrFileNotFound
	}
	return nil
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
