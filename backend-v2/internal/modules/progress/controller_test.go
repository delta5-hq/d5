package progress

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewController(t *testing.T) {
	controller := NewController()

	if controller == nil {
		t.Fatal("NewController() returned nil")
	}
}

func TestProgressEvent_JSONSerialization(t *testing.T) {
	tests := []struct {
		name  string
		event ProgressEvent
		check func(t *testing.T, data map[string]interface{})
	}{
		{
			name: "connected event",
			event: ProgressEvent{
				Type:      "connected",
				Timestamp: 1234567890,
			},
			check: func(t *testing.T, data map[string]interface{}) {
				if data["type"] != "connected" {
					t.Errorf("type = %v, want connected", data["type"])
				}
				if data["timestamp"] != float64(1234567890) {
					t.Errorf("timestamp = %v, want 1234567890", data["timestamp"])
				}
				if _, exists := data["nodeId"]; exists {
					t.Error("nodeId should be omitted for empty value")
				}
				if _, exists := data["state"]; exists {
					t.Error("state should be omitted for empty value")
				}
			},
		},
		{
			name: "progress event with all fields",
			event: ProgressEvent{
				Type:      "progress",
				NodeID:    "node-123",
				State:     "running",
				Timestamp: 9876543210,
			},
			check: func(t *testing.T, data map[string]interface{}) {
				if data["type"] != "progress" {
					t.Errorf("type = %v, want progress", data["type"])
				}
				if data["nodeId"] != "node-123" {
					t.Errorf("nodeId = %v, want node-123", data["nodeId"])
				}
				if data["state"] != "running" {
					t.Errorf("state = %v, want running", data["state"])
				}
				if data["timestamp"] != float64(9876543210) {
					t.Errorf("timestamp = %v, want 9876543210", data["timestamp"])
				}
			},
		},
		{
			name: "heartbeat event",
			event: ProgressEvent{
				Type:      "heartbeat",
				Timestamp: 1111111111,
			},
			check: func(t *testing.T, data map[string]interface{}) {
				if data["type"] != "heartbeat" {
					t.Errorf("type = %v, want heartbeat", data["type"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonData, err := json.Marshal(tt.event)
			if err != nil {
				t.Fatalf("Failed to marshal event: %v", err)
			}

			var parsed map[string]interface{}
			if err := json.Unmarshal(jsonData, &parsed); err != nil {
				t.Fatalf("Failed to unmarshal JSON: %v", err)
			}

			tt.check(t, parsed)
		})
	}
}

func TestProgressEvent_EmptyNodeID(t *testing.T) {
	event := ProgressEvent{
		Type:      "progress",
		NodeID:    "",
		State:     "running",
		Timestamp: time.Now().UnixMilli(),
	}

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if _, exists := parsed["nodeId"]; exists {
		t.Error("Empty nodeId should be omitted due to omitempty")
	}
}

func TestProgressEvent_EmptyState(t *testing.T) {
	event := ProgressEvent{
		Type:      "progress",
		NodeID:    "node-1",
		State:     "",
		Timestamp: time.Now().UnixMilli(),
	}

	data, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if _, exists := parsed["state"]; exists {
		t.Error("Empty state should be omitted due to omitempty")
	}
}
