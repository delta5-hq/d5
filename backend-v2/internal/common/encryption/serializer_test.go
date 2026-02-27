package encryption

import (
	"reflect"
	"testing"
)

func TestSerializer_Serialize(t *testing.T) {
	serializer := NewSerializer()

	tests := []struct {
		name    string
		value   interface{}
		want    string
		wantErr bool
	}{
		{
			name:  "handles string",
			value: "plain string",
			want:  "plain string",
		},
		{
			name:  "handles empty string",
			value: "",
			want:  "",
		},
		{
			name:  "handles nil",
			value: nil,
			want:  "",
		},
		{
			name:  "serializes map",
			value: map[string]string{"key": "value"},
			want:  `{"key":"value"}`,
		},
		{
			name:  "serializes nested object",
			value: map[string]interface{}{"outer": map[string]string{"inner": "value"}},
			want:  `{"outer":{"inner":"value"}}`,
		},
		{
			name:  "serializes array",
			value: []string{"a", "b", "c"},
			want:  `["a","b","c"]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := serializer.Serialize(tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("Serialize() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("Serialize() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSerializer_Deserialize(t *testing.T) {
	serializer := NewSerializer()

	tests := []struct {
		name    string
		value   string
		want    interface{}
		wantErr bool
	}{
		{
			name:  "handles plain string",
			value: "plain string",
			want:  "plain string",
		},
		{
			name:  "handles empty string",
			value: "",
			want:  "",
		},
		{
			name:  "deserializes JSON object",
			value: `{"key":"value"}`,
			want:  map[string]interface{}{"key": "value"},
		},
		{
			name:  "deserializes JSON array",
			value: `["a","b","c"]`,
			want:  []interface{}{"a", "b", "c"},
		},
		{
			name:  "deserializes number",
			value: `42`,
			want:  float64(42),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := serializer.Deserialize(tt.value)
			if (err != nil) != tt.wantErr {
				t.Errorf("Deserialize() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("Deserialize() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSerializer_RoundTrip(t *testing.T) {
	serializer := NewSerializer()

	tests := []struct {
		name  string
		value interface{}
	}{
		{
			name:  "map round trip",
			value: map[string]interface{}{"key": "value", "number": float64(42)},
		},
		{
			name:  "array round trip",
			value: []interface{}{"a", "b", "c"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			serialized, err := serializer.Serialize(tt.value)
			if err != nil {
				t.Fatalf("Serialize failed: %v", err)
			}

			deserialized, err := serializer.Deserialize(serialized)
			if err != nil {
				t.Fatalf("Deserialize failed: %v", err)
			}

			if !reflect.DeepEqual(deserialized, tt.value) {
				t.Errorf("round trip failed: got %v, want %v", deserialized, tt.value)
			}
		})
	}
}
