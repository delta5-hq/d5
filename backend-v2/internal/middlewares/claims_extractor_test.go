package middlewares_test

import (
	"backend-v2/internal/middlewares"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestClaimsExtractor_ExtractUserID_FromSubject(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"sub": "user123",
	}

	userID := extractor.ExtractUserID(claims)

	if userID != "user123" {
		t.Errorf("ExtractUserID() = %q, want %q", userID, "user123")
	}
}

func TestClaimsExtractor_ExtractUserID_FromUserIDField(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"userId": "user456",
	}

	userID := extractor.ExtractUserID(claims)

	if userID != "user456" {
		t.Errorf("ExtractUserID() = %q, want %q", userID, "user456")
	}
}

func TestClaimsExtractor_ExtractUserID_PreferSubjectOverUserID(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"sub":    "from-subject",
		"userId": "from-userId",
	}

	userID := extractor.ExtractUserID(claims)

	if userID != "from-subject" {
		t.Errorf("ExtractUserID() = %q, want %q (subject should take precedence)",
			userID, "from-subject")
	}
}

func TestClaimsExtractor_ExtractUserID_MissingBothFields(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"roles": []interface{}{"admin"},
	}

	userID := extractor.ExtractUserID(claims)

	if userID != "" {
		t.Errorf("ExtractUserID() = %q, want empty string", userID)
	}
}

func TestClaimsExtractor_ExtractUserID_EmptyValues(t *testing.T) {
	tests := []struct {
		name   string
		claims jwt.MapClaims
		expect string
	}{
		{
			name:   "empty subject",
			claims: jwt.MapClaims{"sub": ""},
			expect: "",
		},
		{
			name:   "empty userId",
			claims: jwt.MapClaims{"userId": ""},
			expect: "",
		},
		{
			name:   "empty subject with non-empty userId",
			claims: jwt.MapClaims{"sub": "", "userId": "user123"},
			expect: "user123",
		},
	}

	extractor := middlewares.NewClaimsExtractor()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := extractor.ExtractUserID(tt.claims)

			if userID != tt.expect {
				t.Errorf("ExtractUserID() = %q, want %q", userID, tt.expect)
			}
		})
	}
}

func TestClaimsExtractor_ExtractUserID_WrongTypes(t *testing.T) {
	tests := []struct {
		name   string
		claims jwt.MapClaims
	}{
		{
			name:   "subject as number",
			claims: jwt.MapClaims{"sub": 12345},
		},
		{
			name:   "subject as boolean",
			claims: jwt.MapClaims{"sub": true},
		},
		{
			name:   "subject as array",
			claims: jwt.MapClaims{"sub": []string{"user1", "user2"}},
		},
		{
			name:   "subject as object",
			claims: jwt.MapClaims{"sub": map[string]string{"id": "user1"}},
		},
		{
			name:   "userId as number",
			claims: jwt.MapClaims{"userId": 67890},
		},
	}

	extractor := middlewares.NewClaimsExtractor()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := extractor.ExtractUserID(tt.claims)

			if userID != "" {
				t.Errorf("ExtractUserID() = %q, want empty string for wrong type", userID)
			}
		})
	}
}

func TestClaimsExtractor_ExtractRoles_ValidRoles(t *testing.T) {
	tests := []struct {
		name         string
		claims       jwt.MapClaims
		expectRoles  []string
		expectLength int
	}{
		{
			name: "single role",
			claims: jwt.MapClaims{
				"roles": []interface{}{"admin"},
			},
			expectRoles:  []string{"admin"},
			expectLength: 1,
		},
		{
			name: "multiple roles",
			claims: jwt.MapClaims{
				"roles": []interface{}{"admin", "subscriber", "customer"},
			},
			expectRoles:  []string{"admin", "subscriber", "customer"},
			expectLength: 3,
		},
		{
			name:         "missing roles",
			claims:       jwt.MapClaims{},
			expectRoles:  nil,
			expectLength: 0,
		},
		{
			name: "empty roles array",
			claims: jwt.MapClaims{
				"roles": []interface{}{},
			},
			expectRoles:  []string{},
			expectLength: 0,
		},
	}

	extractor := middlewares.NewClaimsExtractor()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			roles := extractor.ExtractRoles(tt.claims)

			if len(roles) != tt.expectLength {
				t.Errorf("ExtractRoles() length = %d, want %d", len(roles), tt.expectLength)
			}

			if tt.expectRoles != nil {
				for i, expectedRole := range tt.expectRoles {
					if i >= len(roles) || roles[i] != expectedRole {
						t.Errorf("ExtractRoles()[%d] = %q, want %q", i,
							roles[i], expectedRole)
					}
				}
			}
		})
	}
}

func TestClaimsExtractor_ExtractRoles_MixedTypes(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"roles": []interface{}{"admin", 123, "subscriber", true, nil, "customer"},
	}

	roles := extractor.ExtractRoles(claims)

	expectedRoles := []string{"admin", "subscriber", "customer"}

	if len(roles) != len(expectedRoles) {
		t.Errorf("ExtractRoles() length = %d, want %d (non-string values should be skipped)",
			len(roles), len(expectedRoles))
	}

	for i, expected := range expectedRoles {
		if i >= len(roles) || roles[i] != expected {
			t.Errorf("ExtractRoles()[%d] = %q, want %q", i, roles[i], expected)
		}
	}
}

func TestClaimsExtractor_ExtractRoles_WrongType(t *testing.T) {
	tests := []struct {
		name   string
		claims jwt.MapClaims
	}{
		{
			name:   "roles as string",
			claims: jwt.MapClaims{"roles": "admin"},
		},
		{
			name:   "roles as number",
			claims: jwt.MapClaims{"roles": 123},
		},
		{
			name:   "roles as boolean",
			claims: jwt.MapClaims{"roles": true},
		},
		{
			name:   "roles as object",
			claims: jwt.MapClaims{"roles": map[string]string{"role": "admin"}},
		},
	}

	extractor := middlewares.NewClaimsExtractor()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			roles := extractor.ExtractRoles(tt.claims)

			if roles != nil {
				t.Errorf("ExtractRoles() = %v, want nil for wrong type", roles)
			}
		})
	}
}

func TestClaimsExtractor_ExtractRoles_EmptyStrings(t *testing.T) {
	extractor := middlewares.NewClaimsExtractor()

	claims := jwt.MapClaims{
		"roles": []interface{}{"admin", "", "subscriber", ""},
	}

	roles := extractor.ExtractRoles(claims)

	expectedRoles := []string{"admin", "", "subscriber", ""}

	if len(roles) != len(expectedRoles) {
		t.Errorf("ExtractRoles() length = %d, want %d", len(roles), len(expectedRoles))
	}

	for i, expected := range expectedRoles {
		if i >= len(roles) || roles[i] != expected {
			t.Errorf("ExtractRoles()[%d] = %q, want %q", i, roles[i], expected)
		}
	}
}

func BenchmarkClaimsExtractor_ExtractUserID(b *testing.B) {
	extractor := middlewares.NewClaimsExtractor()
	claims := jwt.MapClaims{
		"sub":   "user123",
		"roles": []interface{}{"admin", "subscriber"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		extractor.ExtractUserID(claims)
	}
}

func BenchmarkClaimsExtractor_ExtractRoles(b *testing.B) {
	extractor := middlewares.NewClaimsExtractor()
	claims := jwt.MapClaims{
		"sub":   "user123",
		"roles": []interface{}{"admin", "subscriber", "customer"},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		extractor.ExtractRoles(claims)
	}
}
