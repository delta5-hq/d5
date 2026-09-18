package database

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type fakeGridFSFileCursor struct {
	file      gridfs.File
	decodeErr error
	cursorErr error
	next      bool
}

type fakeGridFSDeleteCollection struct {
	name        string
	steps       *[]string
	deleteOne   *mongo.DeleteResult
	deleteMany  *mongo.DeleteResult
	deleteError error
}

func (f *fakeGridFSDeleteCollection) DeleteOne(
	context.Context,
	interface{},
	...*options.DeleteOptions,
) (*mongo.DeleteResult, error) {
	*f.steps = append(*f.steps, f.name+":one")
	return f.deleteOne, f.deleteError
}

func (f *fakeGridFSDeleteCollection) DeleteMany(
	context.Context,
	interface{},
	...*options.DeleteOptions,
) (*mongo.DeleteResult, error) {
	*f.steps = append(*f.steps, f.name+":many")
	return f.deleteMany, f.deleteError
}

func (f *fakeGridFSFileCursor) Next(context.Context) bool {
	if !f.next {
		return false
	}
	f.next = false
	return true
}

func (f *fakeGridFSFileCursor) Decode(value interface{}) error {
	if f.decodeErr != nil {
		return f.decodeErr
	}
	*(value.(*gridfs.File)) = f.file
	return nil
}

func (f *fakeGridFSFileCursor) Err() error                  { return f.cursorErr }
func (f *fakeGridFSFileCursor) Close(context.Context) error { return nil }

func TestCollectGridFSFilesReturnsDecodeFailure(t *testing.T) {
	cursor := &fakeGridFSFileCursor{next: true, decodeErr: errors.New("decode failed")}
	files, err := collectGridFSFiles(context.Background(), cursor, nil)
	require.Nil(t, files)
	require.ErrorContains(t, err, "decode GridFS file")
}

func TestCollectGridFSFilesReturnsCursorFailure(t *testing.T) {
	cursor := &fakeGridFSFileCursor{cursorErr: errors.New("cursor failed")}
	files, err := collectGridFSFiles(context.Background(), cursor, nil)
	require.Nil(t, files)
	require.ErrorContains(t, err, "iterate GridFS files")
}

func TestCollectGridFSFilesRejectsUnexpectedFileID(t *testing.T) {
	cursor := &fakeGridFSFileCursor{next: true, file: gridfs.File{ID: "not-an-object-id"}}
	files, err := collectGridFSFiles(context.Background(), cursor, nil)
	require.Nil(t, files)
	require.ErrorContains(t, err, "expected ObjectID")
}

func TestCollectGridFSFilesReturnsDecodedFile(t *testing.T) {
	id := primitive.NewObjectID()
	cursor := &fakeGridFSFileCursor{next: true, file: gridfs.File{ID: id, Name: "evidence.txt", Length: 12}}
	files, err := collectGridFSFiles(context.Background(), cursor, nil)
	require.NoError(t, err)
	require.Len(t, files, 1)
	require.Equal(t, id, files[0].ID)
	require.Equal(t, "evidence.txt", files[0].Filename)
}

func TestDeleteGridFSFileRemovesChunksBeforeMetadata(t *testing.T) {
	steps := []string{}
	bucket := &GridFSBucket{
		chunksColl: &fakeGridFSDeleteCollection{
			name: "chunks", steps: &steps, deleteMany: &mongo.DeleteResult{DeletedCount: 2},
		},
		filesColl: &fakeGridFSDeleteCollection{
			name: "files", steps: &steps, deleteOne: &mongo.DeleteResult{DeletedCount: 1},
		},
	}
	require.NoError(t, bucket.Delete(context.Background(), primitive.NewObjectID()))
	require.Equal(t, []string{"chunks:many", "files:one"}, steps)
}

func TestDeleteGridFSFileKeepsMetadataRetryableWhenChunkDeleteFails(t *testing.T) {
	steps := []string{}
	bucket := &GridFSBucket{
		chunksColl: &fakeGridFSDeleteCollection{
			name: "chunks", steps: &steps, deleteError: errors.New("chunk storage unavailable"),
		},
		filesColl: &fakeGridFSDeleteCollection{
			name: "files", steps: &steps, deleteOne: &mongo.DeleteResult{DeletedCount: 1},
		},
	}
	err := bucket.Delete(context.Background(), primitive.NewObjectID())
	require.ErrorContains(t, err, "delete GridFS chunks")
	require.Equal(t, []string{"chunks:many"}, steps)
}

func TestDeleteGridFSFileCleansLegacyOrphanChunksWithoutMetadata(t *testing.T) {
	steps := []string{}
	bucket := &GridFSBucket{
		chunksColl: &fakeGridFSDeleteCollection{
			name: "chunks", steps: &steps, deleteMany: &mongo.DeleteResult{DeletedCount: 2},
		},
		filesColl: &fakeGridFSDeleteCollection{
			name: "files", steps: &steps, deleteOne: &mongo.DeleteResult{},
		},
	}
	require.NoError(t, bucket.Delete(context.Background(), primitive.NewObjectID()))
}

func TestDeleteGridFSFileReportsAlreadyAbsent(t *testing.T) {
	steps := []string{}
	bucket := &GridFSBucket{
		chunksColl: &fakeGridFSDeleteCollection{
			name: "chunks", steps: &steps, deleteMany: &mongo.DeleteResult{},
		},
		filesColl: &fakeGridFSDeleteCollection{
			name: "files", steps: &steps, deleteOne: &mongo.DeleteResult{},
		},
	}
	err := bucket.Delete(context.Background(), primitive.NewObjectID())
	require.ErrorIs(t, err, gridfs.ErrFileNotFound)
}
