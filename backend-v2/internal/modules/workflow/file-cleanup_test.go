package workflow

import (
	"context"
	"errors"
	"testing"

	"backend-v2/internal/database"

	"github.com/stretchr/testify/require"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type fakeWorkflowFileCleaner struct {
	files       []database.GridFSFile
	findErr     error
	deleteErrAt map[string]error
	deleted     []string
}

func (f *fakeWorkflowFileCleaner) FindByWorkflowID(context.Context, string) ([]database.GridFSFile, error) {
	return f.files, f.findErr
}

func (f *fakeWorkflowFileCleaner) Delete(_ context.Context, id string) error {
	f.deleted = append(f.deleted, id)
	return f.deleteErrAt[id]
}

func TestDeleteWorkflowFilesDeletesEveryOwnedFile(t *testing.T) {
	first := primitive.NewObjectID()
	second := primitive.NewObjectID()
	repo := &fakeWorkflowFileCleaner{files: []database.GridFSFile{{ID: first}, {ID: second}}}

	err := deleteWorkflowFiles(context.Background(), repo, "wf-1")

	require.NoError(t, err)
	require.Equal(t, []string{first.Hex(), second.Hex()}, repo.deleted)
}

func TestDeleteWorkflowFilesContinuesAfterAnIndividualFailure(t *testing.T) {
	first := primitive.NewObjectID()
	second := primitive.NewObjectID()
	repo := &fakeWorkflowFileCleaner{
		files:       []database.GridFSFile{{ID: first}, {ID: second}},
		deleteErrAt: map[string]error{first.Hex(): errors.New("storage unavailable")},
	}

	err := deleteWorkflowFiles(context.Background(), repo, "wf-1")

	require.Error(t, err)
	require.Equal(t, []string{first.Hex(), second.Hex()}, repo.deleted)
}

func TestDeleteWorkflowFilesDoesNotDeleteWhenListingFails(t *testing.T) {
	repo := &fakeWorkflowFileCleaner{findErr: errors.New("storage unavailable")}

	err := deleteWorkflowFiles(context.Background(), repo, "wf-1")

	require.Error(t, err)
	require.Empty(t, repo.deleted)
}
