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

func TestNode_ClearStaleTitleProjection(t *testing.T) {
	for _, tc := range []struct {
		name        string
		node        Node
		wantCleared bool
	}{
		{
			name:        "nil projection stays nil",
			node:        Node{Title: "Changed"},
			wantCleared: false,
		},
		{
			name: "matching source title is preserved",
			node: Node{
				Title: "Alpha\n\nBeta\n\nGamma",
				TitleProjection: &TitleProjection{
					SourceTitle: "Alpha\n\nBeta\n\nGamma",
					ChildIDs:    []string{"child-1"},
					NodeIDs:     []string{"child-1"},
				},
			},
			wantCleared: false,
		},
		{
			name: "stale source title is cleared",
			node: Node{
				Title: "Changed",
				TitleProjection: &TitleProjection{
					SourceTitle: "Alpha\n\nBeta\n\nGamma",
					ChildIDs:    []string{"child-1"},
					NodeIDs:     []string{"child-1"},
				},
			},
			wantCleared: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			node := tc.node
			node.ClearStaleTitleProjection()

			if tc.wantCleared {
				if node.TitleProjection != nil {
					t.Fatalf("expected stale projection to be cleared, got %+v", node.TitleProjection)
				}
				return
			}

			if node.TitleProjection == nil && tc.node.TitleProjection != nil {
				t.Fatal("expected projection to be preserved, got nil")
			}
			if node.TitleProjection != nil && node.TitleProjection.SourceTitle != node.Title {
				t.Fatalf("preserved projection must match title: projection=%+v title=%q", node.TitleProjection, node.Title)
			}
		})
	}
}
