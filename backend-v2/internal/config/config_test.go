package config

import "testing"

func TestDatabaseFromURI(t *testing.T) {
	cases := []struct {
		rawURI string
		want   string
	}{
		{"mongodb://localhost:27017/delta5-dev", "delta5-dev"},
		{"mongodb://localhost:27017/delta5", "delta5"},
		{"mongodb://user:pass@host:27017/mydb", "mydb"},
		{"mongodb://localhost:27017/", ""},
		{"mongodb://localhost:27017", ""},
		{"mongodb://localhost:27017/delta5?authSource=admin", "delta5"},
		{"mongodb+srv://user:pass@cluster.example.com/myapp", "myapp"},
		{"", ""},
		{"not-a-url\x00bad", ""},
	}

	for _, tc := range cases {
		got := databaseFromURI(tc.rawURI)
		if got != tc.want {
			t.Errorf("databaseFromURI(%q) = %q; want %q", tc.rawURI, got, tc.want)
		}
	}
}
