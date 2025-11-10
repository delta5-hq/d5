package macro

import (
	"backend-v2/internal/models"
	"context"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *Service {
	return &Service{
		collection: db.Collection("macros"),
	}
}

func (s *Service) Create(ctx context.Context, macro *models.Macro) (string, error) {
	now := time.Now()
	macro.UpdatedAt = now
	macro.CreatedAt = now

	result, err := s.collection.InsertOne(ctx, macro)
	if err != nil {
		return "", err
	}

	oid := result.InsertedID.(primitive.ObjectID)
	return oid.Hex(), nil
}

func (s *Service) FindByName(ctx context.Context, name string) (*models.Macro, error) {
	var macro models.Macro
	err := s.collection.Find(ctx, qmgo.M{"name": name}).One(&macro)
	if err != nil {
		return nil, err
	}
	return &macro, nil
}

func (s *Service) FindByUserID(ctx context.Context, userID string) ([]models.Macro, error) {
	var macros []models.Macro
	err := s.collection.Find(ctx, qmgo.M{"userId": userID}).Sort("-updatedAt").All(&macros)
	if err != nil {
		return nil, err
	}
	return macros, nil
}

func (s *Service) FindByID(ctx context.Context, id string) (*models.Macro, error) {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, err
	}

	var macro models.Macro
	err = s.collection.Find(ctx, qmgo.M{"_id": objID}).One(&macro)
	if err != nil {
		return nil, err
	}
	return &macro, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	objID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return err
	}

	return s.collection.Remove(ctx, qmgo.M{"_id": objID})
}
