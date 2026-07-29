package main

import (
	"context"
	"flag"
	"io"
	"os"
	"strings"
	"time"

	"backend-v2/internal/common/checkedlog"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

type seedOptions struct {
	mongoURI string
	dropDB   bool
}

type User struct {
	ID             string    `bson:"_id"`
	UserID         string    `bson:"id"`
	Name           string    `bson:"name"`
	Mail           string    `bson:"mail"`
	Password       string    `bson:"password"`
	Roles          []string  `bson:"roles"`
	Confirmed      bool      `bson:"confirmed"`
	LimitWorkflows int       `bson:"limitWorkflows"`
	LimitNodes     int       `bson:"limitNodes"`
	CreatedAt      time.Time `bson:"createdAt"`
	UpdatedAt      time.Time `bson:"updatedAt"`
}

func hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	return string(bytes), err
}

func main() {
	if err := checkedlog.ConfigureDefaultFromEnv(); err != nil {
		checkedlog.EmitStartupFailureToStderr()
		os.Exit(1)
	}

	seedCfg, err := parseSeedOptions(os.Args[1:])
	if err != nil {
		checkedlog.EmitStartupFailureToStderr()
		os.Exit(2)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(seedCfg.mongoURI))
	if err != nil {
		checkedlog.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer func() {
		if err := client.Disconnect(ctx); err != nil {
			checkedlog.Warnf("Warning: Failed to disconnect from MongoDB: %v", err)
		}
	}()

	if err := client.Ping(ctx, nil); err != nil {
		checkedlog.Fatalf("Failed to ping MongoDB: %v", err)
	}

	// Extract database name from URI
	dbName := extractDatabaseName(seedCfg.mongoURI)
	if dbName == "" {
		checkedlog.Fatalf("Failed to extract database name from URI")
	}

	db := client.Database(dbName)

	/* Drop database if requested - ensures clean state */
	if seedCfg.dropDB {
		checkedlog.Infof("→ Dropping database '%s' for clean state", dbName)
		if err := db.Drop(ctx); err != nil {
			checkedlog.Fatalf("Failed to drop database: %v", err)
		}
	}

	usersCollection := db.Collection("users")
	waitlistCollection := db.Collection("waitlists")

	adminHash, _ := hashPassword("P@ssw0rd!")
	subscriberHash, _ := hashPassword("P@ssw0rd!")
	customerHash, _ := hashPassword("P@ssw0rd!")

	baseUsers := []User{
		{
			ID:             "admin",
			UserID:         "admin",
			Name:           "admin",
			Mail:           "admin@dreaktor.com",
			Password:       adminHash,
			Roles:          []string{"subscriber", "administrator"},
			Confirmed:      true,
			LimitWorkflows: 0,
			LimitNodes:     0,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
		{
			ID:             "subscriber",
			UserID:         "subscriber",
			Name:           "subscriber",
			Mail:           "subscriber@dreaktor.com",
			Password:       subscriberHash,
			Roles:          []string{"subscriber"},
			Confirmed:      true,
			LimitWorkflows: 10,
			LimitNodes:     300,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
		{
			ID:             "customer",
			UserID:         "customer",
			Name:           "customer",
			Mail:           "customer@dreaktor.com",
			Password:       customerHash,
			Roles:          []string{"customer"},
			Confirmed:      true,
			LimitWorkflows: 10,
			LimitNodes:     1500,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		},
	}

	if _, err := waitlistCollection.DeleteMany(ctx, bson.M{}); err != nil {
		checkedlog.Fatalf("Failed to clear waitlists: %v", err)
	}

	/* Clean up test data collections for deterministic test state */
	testDataCollections := []string{"workflows", "macros", "templates", "integrations", "llmvectors"}
	baseUserIDs := []string{"admin", "subscriber", "customer"}

	for _, collName := range testDataCollections {
		coll := db.Collection(collName)
		filter := bson.M{"userId": bson.M{"$in": baseUserIDs}}
		if _, err := coll.DeleteMany(ctx, filter); err != nil {
			checkedlog.Warnf("Warning: Failed to clean %s: %v", collName, err)
		}
	}

	for _, user := range baseUsers {
		filter := bson.M{"$or": []bson.M{
			{"id": user.UserID},
			{"mail": user.Mail},
		}}
		if _, err := usersCollection.DeleteMany(ctx, filter); err != nil {
			checkedlog.Warnf("Warning: Failed to delete existing user %s: %v", user.UserID, err)
		}

		if _, err := usersCollection.InsertOne(ctx, user); err != nil {
			checkedlog.Fatalf("Failed to insert user %s: %v", user.UserID, err)
		}
	}
	if err := seedAdminIntegration(ctx, db, "admin"); err != nil {
		checkedlog.Fatalf("Failed to seed admin integration: %v", err)
	}

	portInfo := ""
	if len(seedCfg.mongoURI) > 0 {
		if contains(seedCfg.mongoURI, "27018") {
			portInfo = " (E2E)"
		} else if contains(seedCfg.mongoURI, "27017") {
			portInfo = " (dev)"
		}
	}

	checkedlog.Infof("E2E base users seeded: admin, subscriber, customer%s", portInfo)
	os.Exit(0)
}

func parseSeedOptions(args []string) (seedOptions, error) {
	flags := flag.NewFlagSet("seed-users", flag.ContinueOnError)
	flags.SetOutput(io.Discard)
	mongoURI := flags.String("uri", "mongodb://localhost:27017/delta5", "MongoDB URI")
	dropDB := flags.Bool("drop", false, "Drop database before seeding")
	if err := flags.Parse(args); err != nil {
		return seedOptions{}, err
	}
	return seedOptions{mongoURI: *mongoURI, dropDB: *dropDB}, nil
}

func extractDatabaseName(uri string) string {
	// Extract database name from MongoDB URI
	// Format: mongodb://host:port/database or mongodb://host:port/database?params

	// Check if URI has the protocol prefix
	if !strings.HasPrefix(uri, "mongodb://") && !strings.HasPrefix(uri, "mongodb+srv://") {
		return ""
	}

	// Remove protocol
	uri = strings.TrimPrefix(uri, "mongodb://")
	uri = strings.TrimPrefix(uri, "mongodb+srv://")

	// Find the first occurrence of '/' after host:port
	slashIndex := strings.Index(uri, "/")
	if slashIndex == -1 {
		return ""
	}

	// Extract substring after '/'
	dbPart := uri[slashIndex+1:]

	// Empty after slash means no database
	if dbPart == "" {
		return ""
	}

	// Remove query parameters if present
	if qIndex := strings.Index(dbPart, "?"); qIndex != -1 {
		dbPart = dbPart[:qIndex]
	}

	return dbPart
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) &&
		(s[:len(substr)] == substr || s[len(s)-len(substr):] == substr ||
			len(s) > len(substr) && findSubstr(s, substr)))
}

func findSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
