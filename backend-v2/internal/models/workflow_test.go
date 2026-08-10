package models

import (
	"encoding/json"
	"testing"
)

func TestNodePreservesCheckedSelectionState(t *testing.T) {
	for _, tc := range []struct {
		name string
		body string
		want bool
	}{
		{name: "selected", body: `{"id":"n1","title":"A","checked":true}`, want: true},
		{name: "unselected", body: `{"id":"n1","title":"A","checked":false}`, want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var node Node
			if err := json.Unmarshal([]byte(tc.body), &node); err != nil {
				t.Fatalf("unmarshal node: %v", err)
			}
			if node.Checked != tc.want {
				t.Fatalf("expected checked=%v after workflow JSON decode, got %v", tc.want, node.Checked)
			}

			encoded, err := json.Marshal(node)
			if err != nil {
				t.Fatalf("marshal node: %v", err)
			}

			var roundTrip map[string]interface{}
			if err := json.Unmarshal(encoded, &roundTrip); err != nil {
				t.Fatalf("unmarshal encoded node: %v", err)
			}
			if roundTrip["checked"] != tc.want {
				t.Fatalf("expected checked=%v in workflow JSON encode, got %v", tc.want, roundTrip["checked"])
			}
		})
	}
}
