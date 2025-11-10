package template

import (
	"backend-v2/internal/models"
	"context"
	"time"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *Service {
	return &Service{
		collection: db.Collection("templates"),
	}
}

/* List templates visible to user (owned + public) */
func (s *Service) List(ctx context.Context, userID string) ([]models.WorkflowTemplate, error) {
	var templates []models.WorkflowTemplate

	filter := bson.M{
		"$or": []bson.M{
			{"userId": userID},
			{"share.public": true},
		},
	}

	err := s.collection.Find(ctx, filter).Sort("-updatedAt").All(&templates)
	return templates, err
}

/* Get template by ID */
func (s *Service) GetByID(ctx context.Context, templateID string) (*models.WorkflowTemplate, error) {
	var template models.WorkflowTemplate

	objectID, err := primitive.ObjectIDFromHex(templateID)
	if err != nil {
		return nil, err
	}

	err = s.collection.Find(ctx, bson.M{"_id": objectID}).One(&template)
	if err != nil {
		return nil, err
	}

	return &template, nil
}

/* Create new template */
func (s *Service) Create(ctx context.Context, template *models.WorkflowTemplate) error {
	template.TemplateID = primitive.NewObjectID()
	_, err := s.collection.InsertOne(ctx, template)
	return err
}

/* Update existing template */
func (s *Service) Update(ctx context.Context, templateID string, template *models.WorkflowTemplate) error {
	objectID, err := primitive.ObjectIDFromHex(templateID)
	if err != nil {
		return err
	}

	template.TemplateID = objectID
	return s.collection.ReplaceOne(ctx, bson.M{"_id": objectID}, template)
}

/* Delete template */
func (s *Service) Delete(ctx context.Context, templateID string) error {
	objectID, err := primitive.ObjectIDFromHex(templateID)
	if err != nil {
		return err
	}

	return s.collection.Remove(ctx, bson.M{"_id": objectID})
}

/* Update background image */
func (s *Service) UpdateBackgroundImage(ctx context.Context, templateID string, imageID string) (*models.WorkflowTemplate, error) {
	objectID, err := primitive.ObjectIDFromHex(templateID)
	if err != nil {
		return nil, err
	}

	update := bson.M{
		"$set": bson.M{
			"backgroundImage": imageID,
			"updatedAt":       time.Now(),
		},
	}

	var template models.WorkflowTemplate
	err = s.collection.Find(ctx, bson.M{"_id": objectID}).Apply(qmgo.Change{
		Update:    update,
		ReturnNew: true,
	}, &template)

	return &template, err
}
