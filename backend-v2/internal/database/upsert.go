package database

import (
	"context"

	"github.com/qiniu/qmgo"
	qmgoOpts "github.com/qiniu/qmgo/options"
	mongoOpts "go.mongodb.org/mongo-driver/mongo/options"
)

// AtomicUpsertOne eliminates the find-then-insert/update race that causes duplicate-key
// errors under concurrent first-writes to the same filter key.
func AtomicUpsertOne(ctx context.Context, collection *qmgo.Collection, filter, update interface{}) error {
	return collection.UpdateOne(ctx, filter, update, qmgoOpts.UpdateOptions{
		UpdateOptions: mongoOpts.Update().SetUpsert(true),
	})
}
