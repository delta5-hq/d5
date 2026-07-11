package encryption

import "testing"

func TestMarker_Mark(t *testing.T) {
	marker := NewMarker()

	tests := []struct {
		name       string
		ciphertext string
		want       string
	}{
		{
			name:       "marks ciphertext",
			ciphertext: "abc123",
			want:       "__encrypted__abc123",
		},
		{
			name:       "marks empty string",
			ciphertext: "",
			want:       "__encrypted__",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := marker.Mark(tt.ciphertext)
			if got != tt.want {
				t.Errorf("Mark() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMarker_IsMarked(t *testing.T) {
	marker := NewMarker()

	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{
			name:  "detects marked value",
			value: "__encrypted__abc123",
			want:  true,
		},
		{
			name:  "detects unmarked value",
			value: "plaintext",
			want:  false,
		},
		{
			name:  "detects prefix in middle",
			value: "prefix__encrypted__suffix",
			want:  false,
		},
		{
			name:  "empty string is not marked",
			value: "",
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := marker.IsMarked(tt.value)
			if got != tt.want {
				t.Errorf("IsMarked() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMarker_Unmark(t *testing.T) {
	marker := NewMarker()

	tests := []struct {
		name        string
		markedValue string
		want        string
	}{
		{
			name:        "removes prefix",
			markedValue: "__encrypted__abc123",
			want:        "abc123",
		},
		{
			name:        "handles unmarked value",
			markedValue: "plaintext",
			want:        "plaintext",
		},
		{
			name:        "handles empty string",
			markedValue: "",
			want:        "",
		},
		{
			name:        "handles only prefix",
			markedValue: "__encrypted__",
			want:        "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := marker.Unmark(tt.markedValue)
			if got != tt.want {
				t.Errorf("Unmark() = %v, want %v", got, tt.want)
			}
		})
	}
}
