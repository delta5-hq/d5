package workflow

import (
	"context"

	"backend-v2/internal/models"

	"github.com/qiniu/qmgo"
)

type WorkflowService struct {
	Collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *WorkflowService {
	return &WorkflowService{
		Collection: db.Collection("workflows"),
	}
}

func (s *WorkflowService) GetByWorkflowID(ctx context.Context, workflowId string) (*models.Workflow, error) {
	var wf models.Workflow
	err := s.Collection.Find(ctx, map[string]string{"workflowId": workflowId}).One(&wf)

	if err != nil {
		return nil, err
	}
	return &wf, nil
}

func (s *WorkflowService) UpdateWorkflow(ctx context.Context, workflowId string, update *models.Workflow) error {
	filter := map[string]string{"workflowId": workflowId}

	updateDoc := map[string]*models.Workflow{
		"$set": update,
	}

	err := s.Collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return err
	}

	return nil
}
