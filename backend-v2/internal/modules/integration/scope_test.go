package integration

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson"
)

func TestNormalizeWorkflowID(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected *string
	}{
		{
			name:     "EmptyString",
			input:    "",
			expected: nil,
		},
		{
			name:     "WhitespaceOnly",
			input:    "   ",
			expected: nil,
		},
		{
			name:     "TabsAndSpaces",
			input:    "\t\n  \r",
			expected: nil,
		},
		{
			name:     "ValidWorkflowID",
			input:    "workflow-123",
			expected: stringPtr("workflow-123"),
		},
		{
			name:     "WorkflowIDWithLeadingWhitespace",
			input:    "  workflow-456",
			expected: stringPtr("workflow-456"),
		},
		{
			name:     "WorkflowIDWithTrailingWhitespace",
			input:    "workflow-789  ",
			expected: stringPtr("workflow-789"),
		},
		{
			name:     "WorkflowIDWithBothWhitespace",
			input:    "  workflow-abc  ",
			expected: stringPtr("workflow-abc"),
		},
		{
			name:     "SingleCharacter",
			input:    "x",
			expected: stringPtr("x"),
		},
		{
			name:     "NumericID",
			input:    "12345",
			expected: stringPtr("12345"),
		},
		{
			name:     "UUIDFormat",
			input:    "550e8400-e29b-41d4-a716-446655440000",
			expected: stringPtr("550e8400-e29b-41d4-a716-446655440000"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeWorkflowID(tt.input)

			if tt.expected == nil {
				if result != nil {
					t.Errorf("Expected nil, got %v", *result)
				}
			} else {
				if result == nil {
					t.Errorf("Expected %v, got nil", *tt.expected)
				} else if *result != *tt.expected {
					t.Errorf("Expected %v, got %v", *tt.expected, *result)
				}
			}
		})
	}
}

func TestBuildScopeFilter(t *testing.T) {
	tests := []struct {
		name           string
		scope          ScopeIdentifier
		expectedUserID string
		expectedWfID   interface{}
	}{
		{
			name: "UserLevelScope",
			scope: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: nil,
			},
			expectedUserID: "user-1",
			expectedWfID:   nil,
		},
		{
			name: "WorkflowScope",
			scope: ScopeIdentifier{
				UserID:     "user-2",
				WorkflowID: stringPtr("wf-123"),
			},
			expectedUserID: "user-2",
			expectedWfID:   "wf-123",
		},
		{
			name: "DifferentUser",
			scope: ScopeIdentifier{
				UserID:     "admin",
				WorkflowID: stringPtr("wf-admin-1"),
			},
			expectedUserID: "admin",
			expectedWfID:   "wf-admin-1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter := buildScopeFilter(tt.scope)

			userID, ok := filter["userId"].(string)
			if !ok || userID != tt.expectedUserID {
				t.Errorf("Expected userId=%v, got %v", tt.expectedUserID, userID)
			}

			workflowID := filter["workflowId"]
			if tt.expectedWfID == nil {
				wfIDPtr, ok := workflowID.(*string)
				if ok && wfIDPtr != nil {
					t.Errorf("Expected workflowId=nil, got %v", *wfIDPtr)
				}
			} else {
				wfIDPtr, ok := workflowID.(*string)
				if !ok {
					t.Errorf("Expected workflowId to be *string, got %T", workflowID)
				} else if wfIDPtr == nil || *wfIDPtr != tt.expectedWfID.(string) {
					t.Errorf("Expected workflowId=%v, got %v", tt.expectedWfID, *wfIDPtr)
				}
			}
		})
	}
}

func TestBuildScopeFilter_MongoDBCompatibility(t *testing.T) {
	t.Run("NilWorkflowIDMatchesBSONNull", func(t *testing.T) {
		scope := ScopeIdentifier{
			UserID:     "user-1",
			WorkflowID: nil,
		}

		filter := buildScopeFilter(scope)

		marshaled, err := bson.Marshal(filter)
		if err != nil {
			t.Fatalf("bson.Marshal failed: %v", err)
		}

		var unmarshaled bson.M
		if err := bson.Unmarshal(marshaled, &unmarshaled); err != nil {
			t.Fatalf("bson.Unmarshal failed: %v", err)
		}

		if unmarshaled["workflowId"] != nil {
			t.Errorf("Expected workflowId to be nil after BSON round-trip, got %v", unmarshaled["workflowId"])
		}
	})

	t.Run("NonNilWorkflowIDPreserved", func(t *testing.T) {
		scope := ScopeIdentifier{
			UserID:     "user-2",
			WorkflowID: stringPtr("wf-abc"),
		}

		filter := buildScopeFilter(scope)

		marshaled, err := bson.Marshal(filter)
		if err != nil {
			t.Fatalf("bson.Marshal failed: %v", err)
		}

		var unmarshaled bson.M
		if err := bson.Unmarshal(marshaled, &unmarshaled); err != nil {
			t.Fatalf("bson.Unmarshal failed: %v", err)
		}

		wfID, ok := unmarshaled["workflowId"].(string)
		if !ok || wfID != "wf-abc" {
			t.Errorf("Expected workflowId=wf-abc after BSON round-trip, got %v (type %T)", unmarshaled["workflowId"], unmarshaled["workflowId"])
		}
	})
}

func TestExtractScopeFromRequest(t *testing.T) {
	tests := []struct {
		name           string
		queryParam     string
		userID         string
		expectedUserID string
		expectedWfID   *string
	}{
		{
			name:           "NoWorkflowParam",
			queryParam:     "",
			userID:         "user-1",
			expectedUserID: "user-1",
			expectedWfID:   nil,
		},
		{
			name:           "EmptyWorkflowParam",
			queryParam:     "",
			userID:         "user-2",
			expectedUserID: "user-2",
			expectedWfID:   nil,
		},
		{
			name:           "ValidWorkflowParam",
			queryParam:     "wf-123",
			userID:         "user-3",
			expectedUserID: "user-3",
			expectedWfID:   stringPtr("wf-123"),
		},
		{
			name:           "WorkflowParamWithWhitespace",
			queryParam:     "  wf-456  ",
			userID:         "user-4",
			expectedUserID: "user-4",
			expectedWfID:   stringPtr("wf-456"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Skip("Requires HTTP test infrastructure - scope extraction tested via controller E2E")
		})
	}
}

func TestScopeIdentifier_Equality(t *testing.T) {
	tests := []struct {
		name     string
		scope1   ScopeIdentifier
		scope2   ScopeIdentifier
		expected bool
	}{
		{
			name: "BothUserLevel",
			scope1: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: nil,
			},
			scope2: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: nil,
			},
			expected: true,
		},
		{
			name: "SameWorkflowScope",
			scope1: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: stringPtr("wf-123"),
			},
			scope2: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: stringPtr("wf-123"),
			},
			expected: true,
		},
		{
			name: "DifferentUsers",
			scope1: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: nil,
			},
			scope2: ScopeIdentifier{
				UserID:     "user-2",
				WorkflowID: nil,
			},
			expected: false,
		},
		{
			name: "DifferentWorkflows",
			scope1: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: stringPtr("wf-123"),
			},
			scope2: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: stringPtr("wf-456"),
			},
			expected: false,
		},
		{
			name: "UserLevelVsWorkflowScoped",
			scope1: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: nil,
			},
			scope2: ScopeIdentifier{
				UserID:     "user-1",
				WorkflowID: stringPtr("wf-123"),
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter1 := buildScopeFilter(tt.scope1)
			filter2 := buildScopeFilter(tt.scope2)

			bytes1, _ := bson.Marshal(filter1)
			bytes2, _ := bson.Marshal(filter2)

			equal := string(bytes1) == string(bytes2)
			if equal != tt.expected {
				t.Errorf("Expected equality=%v, got %v", tt.expected, equal)
			}
		})
	}
}

func stringPtr(s string) *string {
	return &s
}
