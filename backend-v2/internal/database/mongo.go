package database

import (
	"context"
	"log"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *qmgo.QmgoClient
var MongoClient *mongo.Client

func Connect(uri, db string) *qmgo.Database {
	var err error

	ctx := context.Background()
	Client, err := qmgo.NewClient(ctx, &qmgo.Config{Uri: uri, Database: db})

	if err != nil {
		log.Fatalf("Mongo connection error: %v", err)
	}

	/* Create separate mongo-driver client for GridFS operations */
	MongoClient, err = mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("Failed to create MongoDB client for GridFS: %v", err)
	}

	return Client.Database(db)
}

func Disconnect() {
	ctx := context.Background()
	if Client != nil {
		Client.Close(ctx)
	}
	if MongoClient != nil {
		if err := MongoClient.Disconnect(ctx); err != nil {
			log.Printf("[WARN] MongoDB disconnect error (non-critical during shutdown): %v", err)
		}
	}
}
