package integration

import (
	"backend-v2/internal/models"
	"context"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
)

/* Repository abstracts Integration data access */
type Repository interface {
	FindByUserID(ctx context.Context, userID string) (*models.Integration, error)
}

/* MongoRepository implements Repository using MongoDB */
type MongoRepository struct {
	db *qmgo.Database
}

func NewMongoRepository(db *qmgo.Database) Repository {
	return &MongoRepository{db: db}
}

/* FindByUserID retrieves Integration document by userID */
func (r *MongoRepository) FindByUserID(ctx context.Context, userID string) (*models.Integration, error) {
	var integration models.Integration
	err := r.db.Collection("integrations").Find(ctx, bson.M{"userId": userID}).One(&integration)
	if err != nil {
		return nil, err
	}
	return &integration, nil
}
