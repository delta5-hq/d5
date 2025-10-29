package database

import (
	"context"
	"log"

	"github.com/qiniu/qmgo"
)

var Client *qmgo.QmgoClient

func Connect(uri, db string) *qmgo.Database {
	var err error

	ctx := context.Background()
	Client, err := qmgo.NewClient(ctx, &qmgo.Config{Uri: uri, Database: db})

	if err != nil {
		log.Fatalf("Mongo connection error: %v", err)
	}

	log.Println("Connected to MongoDB:", db)

	return Client.Database(db)
}

func Disconnect() {
	if Client != nil {
		Client.Close(context.Background())
		log.Println("MongoDB connection closed")
	}
}
