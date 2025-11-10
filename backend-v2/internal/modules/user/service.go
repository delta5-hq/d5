package user

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

type Service struct {
	collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *Service {
	return &Service{
		collection: db.Collection("users"),
	}
}

/* Search users by name (regex) */
func (s *Service) SearchByName(ctx context.Context, query string, limit int) ([]models.User, error) {
	var users []models.User

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
