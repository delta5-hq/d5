package main

import "testing"

func TestExtractDatabaseName(t *testing.T) {
	tests := []struct {
		name string
		uri  string
		want string
	}{
		{
			name: "simple URI",
			uri:  "mongodb://localhost:27017/delta5",
			want: "delta5",
		},
		{
			name: "URI with query params",
			uri:  "mongodb://localhost:27017/delta5?retryWrites=true",
			want: "delta5",
		},
		{
			name: "URI with auth",
			uri:  "mongodb://user:pass@localhost:27017/delta5",
			want: "delta5",
		},
		{
			name: "dev database",
			uri:  "mongodb://localhost:27017/delta5-dev",
			want: "delta5-dev",
		},
		{
			name: "no database",
			uri:  "mongodb://localhost:27017/",
			want: "",
		},
		{
			name: "no slash",
			uri:  "mongodb://localhost:27017",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractDatabaseName(tt.uri)
			if got != tt.want {
				t.Errorf("extractDatabaseName(%q) = %q, want %q", tt.uri, got, tt.want)
			}
		})
	}
}
