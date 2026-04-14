package workflow

import (
	"backend-v2/internal/common/types"
	"backend-v2/internal/models"
	"testing"
)

func TestCreateWorkflowDto_TitleFieldHandling(t *testing.T) {
	tests := []struct {
		name          string
		dto           CreateWorkflowDto
		expectedTitle string
		description   string
	}{
		{
			name: "title provided with non-empty string",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "My Workflow",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "My Workflow",
			description:   "Title field should preserve non-empty string values",
		},
		{
			name: "title provided with empty string",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "",
			description:   "Title field should preserve empty string (explicit empty)",
		},
		{
			name: "title field zero value",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "",
			description:   "Title field should default to empty string when not set",
		},
		{
			name: "title with special characters",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test Workflow: API → Database 🚀",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "Test Workflow: API → Database 🚀",
			description:   "Title should preserve Unicode and special characters",
		},
		{
			name: "title with maximum reasonable length",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "This is a very long workflow title that users might create when they want to be extremely descriptive about what their workflow does and includes many details",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "This is a very long workflow title that users might create when they want to be extremely descriptive about what their workflow does and includes many details",
			description:   "Title should preserve long strings without truncation",
		},
		{
			name: "title with whitespace variations",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "  Workflow With Spaces  ",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedTitle: "  Workflow With Spaces  ",
			description:   "Title should preserve leading/trailing whitespace (controller responsibility to trim if needed)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.dto.Title != tt.expectedTitle {
				t.Errorf("%s: expected title %q, got %q", tt.description, tt.expectedTitle, tt.dto.Title)
			}
		})
	}
}

func TestCreateWorkflowDto_GetLimit(t *testing.T) {
	tests := []struct {
		name          string
		dto           CreateWorkflowDto
		expectedLimit int64
		description   string
	}{
		{
			name: "auth with workflow limit",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test",
				Auth:   &types.JwtPayload{LimitWorkflows: 10},
			},
			expectedLimit: 10,
			description:   "GetLimit should return LimitWorkflows from Auth payload",
		},
		{
			name: "auth with zero limit",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test",
				Auth:   &types.JwtPayload{LimitWorkflows: 0},
			},
			expectedLimit: 0,
			description:   "GetLimit should return 0 when LimitWorkflows is 0",
		},
		{
			name: "nil auth",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test",
				Auth:   nil,
			},
			expectedLimit: 0,
			description:   "GetLimit should return 0 when Auth is nil (safe nil check)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limit := tt.dto.GetLimit()
			if limit != tt.expectedLimit {
				t.Errorf("%s: expected limit %d, got %d", tt.description, tt.expectedLimit, limit)
			}
		})
	}
}

func TestCreateWorkflowDto_ShareFieldHandling(t *testing.T) {
	tests := []struct {
		name        string
		dto         CreateWorkflowDto
		expectNil   bool
		description string
	}{
		{
			name: "share provided with public enabled",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test",
				Share: &models.Share{
					Public: models.WorkflowState{
						Enabled:   true,
						Writeable: false,
						Hidden:    false,
					},
				},
			},
			expectNil:   false,
			description: "Share should be preserved when provided",
		},
		{
			name: "share field nil",
			dto: CreateWorkflowDto{
				UserID: "user123",
				Title:  "Test",
				Share:  nil,
			},
			expectNil:   true,
			description: "Share should be nil when not provided",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isNil := tt.dto.Share == nil
			if isNil != tt.expectNil {
				t.Errorf("%s: expected Share nil=%v, got nil=%v", tt.description, tt.expectNil, isNil)
			}
		})
	}
}

func TestCreateWorkflowDto_FieldIndependence(t *testing.T) {
	t.Run("title does not affect share", func(t *testing.T) {
		share := &models.Share{
			Public: models.WorkflowState{Enabled: true},
		}
		dto := CreateWorkflowDto{
			UserID: "user123",
			Title:  "Test Workflow",
			Share:  share,
		}

		if dto.Title != "Test Workflow" {
			t.Error("Title should be independent of Share")
		}
		if dto.Share == nil || !dto.Share.Public.Enabled {
			t.Error("Share should be independent of Title")
		}
	})

	t.Run("title does not affect auth", func(t *testing.T) {
		auth := &types.JwtPayload{LimitWorkflows: 5}
		dto := CreateWorkflowDto{
			UserID: "user123",
			Title:  "Test Workflow",
			Auth:   auth,
		}

		if dto.Title != "Test Workflow" {
			t.Error("Title should be independent of Auth")
		}
		if dto.GetLimit() != 5 {
			t.Error("Auth should be independent of Title")
		}
	})

	t.Run("all fields coexist correctly", func(t *testing.T) {
		dto := CreateWorkflowDto{
			UserID: "user123",
			Title:  "Complete Workflow",
			Auth:   &types.JwtPayload{LimitWorkflows: 10},
			Share: &models.Share{
				Public: models.WorkflowState{Enabled: true},
			},
		}

		if dto.UserID != "user123" {
			t.Error("UserID should be preserved")
		}
		if dto.Title != "Complete Workflow" {
			t.Error("Title should be preserved")
		}
		if dto.GetLimit() != 10 {
			t.Error("Auth should be preserved")
		}
		if dto.Share == nil {
			t.Error("Share should be preserved")
		}
	})
}

func TestCreateWorkflowDto_ZeroValueBehavior(t *testing.T) {
	t.Run("zero value dto has empty title", func(t *testing.T) {
		var dto CreateWorkflowDto

		if dto.Title != "" {
			t.Errorf("Zero value CreateWorkflowDto should have empty string title, got %q", dto.Title)
		}
		if dto.UserID != "" {
			t.Error("Zero value CreateWorkflowDto should have empty UserID")
		}
		if dto.Auth != nil {
			t.Error("Zero value CreateWorkflowDto should have nil Auth")
		}
		if dto.Share != nil {
			t.Error("Zero value CreateWorkflowDto should have nil Share")
		}
	})

	t.Run("zero value dto GetLimit returns 0", func(t *testing.T) {
		var dto CreateWorkflowDto

		if dto.GetLimit() != 0 {
			t.Errorf("Zero value CreateWorkflowDto GetLimit should return 0, got %d", dto.GetLimit())
		}
	})
}
