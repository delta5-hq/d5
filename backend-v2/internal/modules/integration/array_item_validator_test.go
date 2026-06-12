package integration

import (
	"reflect"
	"strings"
	"testing"
)

type argsFieldCase struct {
	name        string
	fieldName   string
	hasArgs     bool
	args        interface{}
	wantArgs    []string
	wantPresent bool
	wantErr     bool
}

func TestValidateArrayItemShapeArgsField(t *testing.T) {
	tests := []argsFieldCase{
		{name: "registered field accepts omitted args", fieldName: "mcp", hasArgs: false, wantPresent: false},
		{name: "registered field accepts empty args", fieldName: "mcp", hasArgs: true, args: []interface{}{}, wantArgs: []string{}, wantPresent: true},
		{name: "registered field normalizes JSON string array", fieldName: "mcp", hasArgs: true, args: []interface{}{"server.js", "--flag"}, wantArgs: []string{"server.js", "--flag"}, wantPresent: true},
		{name: "registered field copies typed string array", fieldName: "mcp", hasArgs: true, args: []string{"server.js", "--flag"}, wantArgs: []string{"server.js", "--flag"}, wantPresent: true},
		{name: "second registered field uses same args contract", fieldName: "rpc", hasArgs: true, args: []interface{}{"--acp"}, wantArgs: []string{"--acp"}, wantPresent: true},
		{name: "unregistered field is ignored by array item validator", fieldName: "other", hasArgs: true, args: "left untouched", wantPresent: true},
		{name: "registered field rejects string args", fieldName: "mcp", hasArgs: true, args: "server.js", wantErr: true},
		{name: "registered field rejects object args", fieldName: "mcp", hasArgs: true, args: map[string]interface{}{"0": "server.js"}, wantErr: true},
		{name: "registered field rejects numeric args", fieldName: "mcp", hasArgs: true, args: 12, wantErr: true},
		{name: "registered field rejects null args", fieldName: "mcp", hasArgs: true, args: nil, wantErr: true},
		{name: "registered field rejects mixed args array", fieldName: "mcp", hasArgs: true, args: []interface{}{"server.js", 2}, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := buildArrayItem(tt)

			err := validateArrayItemShape(tt.fieldName, item)

			assertArgsValidationResult(t, tt, item, err)
		})
	}
}

func TestValidateArrayItemShapeDoesNotMutateInvalidArgs(t *testing.T) {
	originalArgs := []interface{}{"server.js", 2}
	item := map[string]interface{}{
		"alias": "/tool",
		"args":  originalArgs,
	}

	err := validateArrayItemShape("mcp", item)

	if err == nil {
		t.Fatal("expected validation error")
	}
	if got := item["args"]; !reflect.DeepEqual(got, originalArgs) {
		t.Fatalf("args mutated after validation failure: got %#v want %#v", got, originalArgs)
	}
}

func TestValidateArrayItemShapeCopiesTypedStringArgs(t *testing.T) {
	originalArgs := []string{"server.js"}
	item := map[string]interface{}{
		"alias": "/tool",
		"args":  originalArgs,
	}

	err := validateArrayItemShape("mcp", item)

	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}
	normalized := item["args"].([]string)
	normalized[0] = "changed"
	if originalArgs[0] != "server.js" {
		t.Fatalf("typed args input was aliased instead of copied: %#v", originalArgs)
	}
}

func buildArrayItem(tt argsFieldCase) map[string]interface{} {
	item := map[string]interface{}{"alias": "/tool"}
	if tt.hasArgs {
		item["args"] = tt.args
	}
	return item
}

func assertArgsValidationResult(t *testing.T, tt argsFieldCase, item map[string]interface{}, err error) {
	t.Helper()

	if tt.wantErr {
		assertArgsValidationError(t, err)
		return
	}

	if err != nil {
		t.Fatalf("unexpected validation error: %v", err)
	}

	gotArgs, exists := item["args"]
	if exists != tt.wantPresent {
		t.Fatalf("args presence = %v, want %v", exists, tt.wantPresent)
	}

	if !tt.wantPresent || tt.wantArgs == nil {
		return
	}

	normalized, ok := gotArgs.([]string)
	if !ok {
		t.Fatalf("args type = %T, want []string", gotArgs)
	}
	if !reflect.DeepEqual(normalized, tt.wantArgs) {
		t.Fatalf("args = %#v, want %#v", normalized, tt.wantArgs)
	}
}

func assertArgsValidationError(t *testing.T, err error) {
	t.Helper()

	if err == nil {
		t.Fatal("expected validation error")
	}
	if !isArrayItemValidationError(err) {
		t.Fatalf("expected array item validation error, got %T", err)
	}
	if !strings.Contains(err.Error(), "invalid args") {
		t.Fatalf("expected args validation error, got %v", err)
	}
}
