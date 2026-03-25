package integration

import "testing"

func TestSentinelDetection(t *testing.T) {
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
			name:     "map is not sentinel",
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
