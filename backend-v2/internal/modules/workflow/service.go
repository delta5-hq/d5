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

func (s *WorkflowService) GetByMapID(ctx context.Context, workflowId string) (*models.Workflow, error) {
	var wf models.Workflow
	err := s.Collection.Find(ctx, map[string]interface{}{"workflowId": workflowId}).One(&wf)

	if err != nil {
		return nil, err
	}
	return &wf, nil
}
