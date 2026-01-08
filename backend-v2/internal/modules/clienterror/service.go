package clienterror

import (
	"context"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"

	"backend-v2/internal/models"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(collection *qmgo.Collection) *Service {
	return &Service{collection: collection}
}

/* Create client error */
func (s *Service) Create(ctx context.Context, userID, path, backtrace string, additions map[string]interface{}) error {
	now := time.Now()

	error := models.ClientError{
		ID:        primitive.NewObjectID(),
		UserID:    userID,
		Path:      path,
		Backtrace: backtrace,
		Additions: additions,
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err := s.collection.InsertOne(ctx, error)
	return err
}

/* List errors (admin only) */
func (s *Service) List(ctx context.Context) ([]models.ClientError, error) {
	errors := []models.ClientError{}

	err := s.collection.Find(ctx, bson.M{}).Sort("-updatedAt").Limit(500).All(&errors)

	if err != nil {
		return nil, err
	}

	return errors, nil
}
