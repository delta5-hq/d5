package workflow

import (
	"testing"

	"backend-v2/internal/models"
)

func TestReconcileNodeTitleProjections(t *testing.T) {
	t.Run("drops stale projection and preserves node fields", func(t *testing.T) {
		nodes := map[string]models.Node{
			"root": {
				ID:    "root",
				Title: "Changed",
				TitleProjection: &models.TitleProjection{
					SourceTitle: "Alpha\n\nBeta\n\nGamma",
					ChildIDs:    []string{"child-1"},
					NodeIDs:     []string{"child-1"},
				},
			},
			"child-1": {
				ID:     "child-1",
				Title:  "Alpha",
				Parent: "root",
			},
		}

		reconcileNodeTitleProjections(nodes)

		if got := nodes["root"].TitleProjection; got != nil {
			t.Fatalf("expected stale projection to be dropped, got %+v", got)
		}
		if nodes["root"].Title != "Changed" {
			t.Fatalf("expected title to be preserved, got %q", nodes["root"].Title)
		}
		if nodes["root"].ID != "root" {
			t.Fatalf("expected id to be preserved, got %q", nodes["root"].ID)
		}
	})

	t.Run("preserves projection when source title matches", func(t *testing.T) {
		projection := &models.TitleProjection{
			SourceTitle: "Alpha\n\nBeta\n\nGamma",
			ChildIDs:    []string{"child-1"},
			NodeIDs:     []string{"child-1"},
		}
		nodes := map[string]models.Node{
			"root": {
				ID:              "root",
				Title:           "Alpha\n\nBeta\n\nGamma",
				TitleProjection: projection,
			},
		}

		reconcileNodeTitleProjections(nodes)

		if got := nodes["root"].TitleProjection; got != projection {
			t.Fatalf("expected matching projection to be preserved, got %+v", got)
		}
	})

	t.Run("leaves nodes without projection unchanged", func(t *testing.T) {
		nodes := map[string]models.Node{
			"root": {ID: "root", Title: "Changed"},
		}

		reconcileNodeTitleProjections(nodes)

		if got := nodes["root"].TitleProjection; got != nil {
			t.Fatalf("expected nil projection to remain nil, got %+v", got)
		}
	})
}
