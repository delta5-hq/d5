package integration

import (
	"backend-v2/internal/common/encryption"
	"context"
	"fmt"
	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type MigrationStatistics struct {
	TotalProcessed int
	Migrated       int
	Skipped        int
	Failed         int
	Errors         []string
}

type DocumentMigrator struct {
	encryptor *DocumentEncryptor
	detector  *legacyDetector
}

func NewDocumentMigrator() (*DocumentMigrator, error) {
	encryptor, err := NewDocumentEncryptor()
	if err != nil {
		return nil, err
	}

	detector, err := newLegacyDetector()
	if err != nil {
		return nil, err
	}

	return &DocumentMigrator{
		encryptor: encryptor,
		detector:  detector,
	}, nil
}

func (dm *DocumentMigrator) MigrateDocument(doc map[string]interface{}) (bool, error) {
	userID, ok := doc["userId"].(string)
	if !ok || userID == "" {
		return false, fmt.Errorf("missing userId")
	}

	var workflowID *string
	if wfID, ok := doc["workflowId"].(string); ok && wfID != "" {
		workflowID = &wfID
	}

	hasLegacyData, err := dm.detectLegacyFields(doc, userID, workflowID)
	if err != nil {
		return false, err
	}

	if !hasLegacyData {
		return false, nil
	}

	tempDoc := deepCopyDoc(doc)

	if err := dm.encryptor.Decrypt(tempDoc, userID, workflowID); err != nil {
		return false, fmt.Errorf("decrypt failed: %w", err)
	}

	if err := dm.encryptor.Encrypt(tempDoc, userID, workflowID); err != nil {
		return false, fmt.Errorf("re-encrypt failed: %w", err)
	}

	for k, v := range tempDoc {
		doc[k] = v
	}

	return true, nil
}

func (dm *DocumentMigrator) detectLegacyFields(doc map[string]interface{}, userID string, workflowID *string) (bool, error) {
	wfIDStr := ""
	if workflowID != nil {
		wfIDStr = *workflowID
	}

	for _, path := range dm.encryptor.config.Fields {
		if val := getNestedStringValue(doc, path); val != "" {
			isLegacy, err := dm.detector.isLegacyLLMField(val, userID, wfIDStr, path)
			if err != nil {
				return false, err
			}
			if isLegacy {
				return true, nil
			}
		}
	}

	for arrayName, fieldConfigs := range dm.encryptor.config.ArrayFields {
		items, ok := doc[arrayName].([]interface{})
		if !ok {
			continue
		}

		for _, item := range items {
			itemMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			alias, _ := itemMap["alias"].(string)
			if alias == "" {
				continue
			}

			for _, config := range fieldConfigs {
				if val := getNestedStringValue(itemMap, config.Path); val != "" {
					isLegacy, err := dm.detector.isLegacyArrayField(val, userID, wfIDStr, arrayName, alias, config.Path)
					if err != nil {
						return false, err
					}
					if isLegacy {
						return true, nil
					}
				}
			}
		}
	}

	return false, nil
}

type legacyDetector struct {
	cipher  *encryption.Cipher
	key     []byte
	builder *encryption.ADBuilder
	marker  *encryption.Marker
}

func newLegacyDetector() (*legacyDetector, error) {
	keyDeriv, err := encryption.GetKeyDerivation()
	if err != nil {
		return nil, err
	}

	return &legacyDetector{
		cipher:  encryption.NewCipher(),
		key:     keyDeriv.GetKey(),
		builder: encryption.NewADBuilder(),
		marker:  encryption.NewMarker(),
	}, nil
}

func (d *legacyDetector) isLegacyLLMField(markedCiphertext, userID, workflowID, fieldPath string) (bool, error) {
	if !d.marker.IsMarked(markedCiphertext) {
		return false, nil
	}

	ciphertext := d.marker.Unmark(markedCiphertext)
	ad := d.builder.BuildForLLMField(userID, workflowID, fieldPath)

	_, errWithAD := d.cipher.Decrypt(ciphertext, d.key, ad)
	if errWithAD == nil {
		return false, nil
	}

	_, errWithNil := d.cipher.Decrypt(ciphertext, d.key, nil)
	return errWithNil == nil, nil
}

func (d *legacyDetector) isLegacyArrayField(markedCiphertext, userID, workflowID, arrayName, alias, fieldPath string) (bool, error) {
	if !d.marker.IsMarked(markedCiphertext) {
		return false, nil
	}

	ciphertext := d.marker.Unmark(markedCiphertext)
	ad := d.builder.BuildForArrayField(userID, workflowID, arrayName, alias, fieldPath)

	_, errWithAD := d.cipher.Decrypt(ciphertext, d.key, ad)
	if errWithAD == nil {
		return false, nil
	}

	_, errWithNil := d.cipher.Decrypt(ciphertext, d.key, nil)
	return errWithNil == nil, nil
}

type CollectionMigrator struct {
	collection       *mongo.Collection
	documentMigrator *DocumentMigrator
}

func NewCollectionMigrator(collection *mongo.Collection) (*CollectionMigrator, error) {
	docMigrator, err := NewDocumentMigrator()
	if err != nil {
		return nil, err
	}

	return &CollectionMigrator{
		collection:       collection,
		documentMigrator: docMigrator,
	}, nil
}

func (cm *CollectionMigrator) MigrateAll(ctx context.Context) (*MigrationStatistics, error) {
	cursor, err := cm.collection.Find(ctx, bson.M{})
	if err != nil {
		return nil, fmt.Errorf("find failed: %w", err)
	}
	defer cursor.Close(ctx)

	stats := &MigrationStatistics{}

	for cursor.Next(ctx) {
		var doc map[string]interface{}
		if err := cursor.Decode(&doc); err != nil {
			stats.Failed++
			stats.Errors = append(stats.Errors, fmt.Sprintf("decode failed: %v", err))
			continue
		}

		stats.TotalProcessed++

		migrated, err := cm.documentMigrator.MigrateDocument(doc)
		if err != nil {
			stats.Failed++
			userID, _ := doc["userId"].(string)
			stats.Errors = append(stats.Errors, fmt.Sprintf("userId=%s: %v", userID, err))
			continue
		}

		if migrated {
			update := bson.M{"$set": doc}
			_, err := cm.collection.UpdateOne(ctx, bson.M{"_id": doc["_id"]}, update)
			if err != nil {
				stats.Failed++
				stats.Errors = append(stats.Errors, fmt.Sprintf("update failed: %v", err))
				continue
			}
			stats.Migrated++
		} else {
			stats.Skipped++
		}
	}

	if err := cursor.Err(); err != nil {
		return stats, fmt.Errorf("cursor error: %w", err)
	}

	return stats, nil
}

func deepCopyDoc(doc map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range doc {
		switch val := v.(type) {
		case map[string]interface{}:
			result[k] = deepCopyDoc(val)
		case []interface{}:
			result[k] = deepCopyArr(val)
		default:
			result[k] = v
		}
	}
	return result
}

func deepCopyArr(arr []interface{}) []interface{} {
	result := make([]interface{}, len(arr))
	for i, v := range arr {
		if m, ok := v.(map[string]interface{}); ok {
			result[i] = deepCopyDoc(m)
		} else {
			result[i] = v
		}
	}
	return result
}

func getNestedStringValue(doc map[string]interface{}, path string) string {
	if doc == nil || path == "" {
		return ""
	}

	parts := strings.Split(path, ".")
	current := doc

	for i, part := range parts {
		if i == len(parts)-1 {
			if val, ok := current[part].(string); ok {
				return val
			}
			return ""
		}

		next, ok := current[part].(map[string]interface{})
		if !ok {
			return ""
		}
		current = next
	}

	return ""
}
