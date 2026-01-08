package user

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

type Service struct {
	db         *qmgo.Database
	collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *Service {
	return &Service{
		db:         db,
		collection: db.Collection("users"),
	}
}

/* Search users by name (regex) */
func (s *Service) SearchByName(ctx context.Context, query string, limit int) ([]models.User, error) {
	users := []models.User{}

	/* Exact match for queries < 3 chars, prefix match otherwise */
	var regex string
	if len(query) < 3 {
		regex = "^" + query + "$"
	} else {
		regex = "^" + query + ".*"
	}

	filter := bson.M{
		"name": bson.M{"$regex": regex, "$options": "i"},
	}

	err := s.collection.Find(ctx, filter).
		Select(bson.M{"id": 1, "name": 1, "_id": 0}).
		Limit(int64(limit)).
		All(&users)

	return users, err
}

/* Search user by email (exact match, case-insensitive) */
func (s *Service) SearchByMail(ctx context.Context, email string) (*models.User, error) {
	var user models.User

	filter := bson.M{
		"mail": bson.M{"$regex": "^" + email + "$", "$options": "i"},
	}

	err := s.collection.Find(ctx, filter).
		Select(bson.M{"id": 1, "name": 1, "_id": 0}).
		One(&user)

	if err != nil {
		return nil, err
	}

	return &user, nil
}

/* Upsert user (create or update) */
func (s *Service) Upsert(ctx context.Context, user *models.User) error {
	filter := bson.M{"id": user.ID}

	/* Check if user exists */
	var existing models.User
	err := s.collection.Find(ctx, filter).One(&existing)

	if err != nil {
		/* User doesn't exist - insert new */
		_, err = s.collection.InsertOne(ctx, user)
		return err
	}

	/* User exists - update fields */
	update := bson.M{
		"$set": bson.M{
			"name": user.Name,
		},
	}

	/* Only set mail if provided (social media users may not have email) */
	if user.Mail != "" {
		update["$set"].(bson.M)["mail"] = user.Mail
	}

	/* Set roles if provided */
	if len(user.Roles) > 0 {
		update["$set"].(bson.M)["roles"] = user.Roles
	}

	return s.collection.UpdateOne(ctx, filter, update)
}

func (s *Service) DeleteUserWithRelatedData(ctx context.Context, userId string) error {
	workflowIDs, err := s.collectUserWorkflowIDs(ctx, userId)
	if err != nil {
		return err
	}

	if err := s.deleteWorkflowPaths(ctx, workflowIDs); err != nil {
		return err
	}

	if err := s.deleteWorkflows(ctx, userId); err != nil {
		return err
	}

	if err := s.deleteIntegrations(ctx, userId); err != nil {
		return err
	}

	if err := s.deleteWorkflowFiles(ctx, userId); err != nil {
		return err
	}

	if err := s.deleteTemplates(ctx, userId); err != nil {
		return err
	}

	if err := s.deleteUser(ctx, userId); err != nil {
		return err
	}

	return nil
}

func (s *Service) collectUserWorkflowIDs(ctx context.Context, userId string) ([]string, error) {
	type WorkflowID struct {
		ID string `bson:"_id"`
	}

	workflows := []WorkflowID{}
	err := s.db.Collection("workflows").
		Find(ctx, bson.M{"userId": userId}).
		Select(bson.M{"_id": 1}).
		All(&workflows)

	if err != nil {
		return nil, err
	}

	ids := make([]string, len(workflows))
	for i, wf := range workflows {
		ids[i] = wf.ID
	}

	return ids, nil
}

func (s *Service) deleteWorkflowPaths(ctx context.Context, workflowIDs []string) error {
	if len(workflowIDs) == 0 {
		return nil
	}

	_, err := s.db.Collection("workflowpaths").RemoveAll(ctx, bson.M{
		"workflowId": bson.M{"$in": workflowIDs},
	})
	return err
}

func (s *Service) deleteWorkflows(ctx context.Context, userId string) error {
	_, err := s.db.Collection("workflows").RemoveAll(ctx, bson.M{"userId": userId})
	return err
}

func (s *Service) deleteIntegrations(ctx context.Context, userId string) error {
	_, err := s.db.Collection("integrations").RemoveAll(ctx, bson.M{"userId": userId})
	return err
}

func (s *Service) deleteWorkflowFiles(ctx context.Context, userId string) error {
	collections := []string{"workflowfiles.files", "workflowfiles.chunks", "workflowimages.files", "workflowimages.chunks", "thumbnails.files", "thumbnails.chunks"}

	for _, collName := range collections {
		if _, err := s.db.Collection(collName).RemoveAll(ctx, bson.M{"metadata.userId": userId}); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) deleteTemplates(ctx context.Context, userId string) error {
	_, err := s.db.Collection("templates").RemoveAll(ctx, bson.M{"userId": userId})
	return err
}

func (s *Service) deleteUser(ctx context.Context, userId string) error {
	return s.collection.Remove(ctx, bson.M{"id": userId})
}

/* Get user by ID */
func (s *Service) GetUserByID(ctx context.Context, userId string) (*models.User, error) {
	var user models.User

	filter := bson.M{"id": userId}

	err := s.collection.Find(ctx, filter).
		Select(bson.M{"id": 1, "name": 1, "mail": 1, "roles": 1, "createdAt": 1, "updatedAt": 1, "_id": 0}).
		One(&user)

	if err != nil {
		return nil, err
	}

	return &user, nil
}
