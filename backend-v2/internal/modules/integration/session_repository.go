package integration

import (
	"context"

	"backend-v2/internal/models"

	"github.com/qiniu/qmgo"
)

type SessionRepository struct {
	collection *qmgo.Collection
}

func NewSessionRepository(db *qmgo.Database) *SessionRepository {
	return &SessionRepository{
		collection: db.Collection("integrationsessions"),
	}
}

func (r *SessionRepository) FindAllForUser(ctx context.Context, userID string) ([]models.IntegrationSession, error) {
	var sessions []models.IntegrationSession
	err := r.collection.Find(ctx, map[string]interface{}{"userId": userID}).All(&sessions)
	if err != nil {
		return nil, err
	}
	return sessions, nil
}
