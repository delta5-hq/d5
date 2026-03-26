package integration

import "testing"

func TestSentinelStringDetection(t *testing.T) {
	tests := []struct {
		name     string
		value    interface{}
		expected bool
	}{
		{
			name:     "sentinel string matches",
			value:    "***",
			expected: true,
		},
		{
			name:     "empty string is not sentinel",
			value:    "",
			expected: false,
		},
		{
			name:     "different string is not sentinel",
			value:    "actual-key",
			expected: false,
		},
		{
			name:     "nil is not sentinel",
			value:    nil,
			expected: false,
		},
		{
			name:     "number is not sentinel",
			value:    123,
			expected: false,
		},
		{
			name:     "map is not sentinel string",
			value:    map[string]string{"key": "value"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSentinelValue(tt.value); got != tt.expected {
				t.Errorf("isSentinelValue(%v) = %v, want %v", tt.value, got, tt.expected)
			}
		})
	}
}

func TestSentinelMapDetection(t *testing.T) {
	tests := []struct {
		name     string
		value    interface{}
		expected bool
	}{
		{
			name:     "sentinel map matches",
			value:    map[string]interface{}{"***": "***"},
			expected: true,
		},
		{
			name:     "empty map is not sentinel",
			value:    map[string]interface{}{},
			expected: false,
		},
		{
			name:     "regular map is not sentinel",
			value:    map[string]interface{}{"key": "value"},
			expected: false,
		},
		{
			name:     "map with multiple entries including sentinel is not sentinel",
			value:    map[string]interface{}{"***": "***", "other": "value"},
			expected: false,
		},
		{
			name:     "map with sentinel key but different value is not sentinel",
			value:    map[string]interface{}{"***": "different"},
			expected: false,
		},
		{
			name:     "map with different key but sentinel value is not sentinel",
			value:    map[string]interface{}{"key": "***"},
			expected: false,
		},
		{
			name:     "string is not sentinel map",
			value:    "***",
			expected: false,
		},
		{
			name:     "nil is not sentinel map",
			value:    nil,
			expected: false,
		},
		{
			name:     "number is not sentinel map",
			value:    123,
			expected: false,
		},
		{
			name:     "typed string map sentinel",
			value:    map[string]string{"***": "***"},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isSentinelMap(tt.value); got != tt.expected {
				t.Errorf("isSentinelMap(%v) = %v, want %v", tt.value, got, tt.expected)
			}
		})
	}
}
