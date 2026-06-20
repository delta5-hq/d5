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

type arrayItemValidationMode struct {
	name       string
	buildInput func(argsFieldCase) map[string]interface{}
	validate   func(string, map[string]interface{}) error
}

func TestArrayItemArgsValidationContract(t *testing.T) {
	modes := []arrayItemValidationMode{
		{name: "create", buildInput: buildArrayItem, validate: validateArrayItemShape},
		{name: "update", buildInput: buildUpdatePatch, validate: validateArrayItemUpdateShape},
	}

	tests := []argsFieldCase{
		{name: "mcp accepts omitted args", fieldName: "mcp", hasArgs: false, wantPresent: false},
		{name: "mcp accepts empty args", fieldName: "mcp", hasArgs: true, args: []interface{}{}, wantArgs: []string{}, wantPresent: true},
		{name: "mcp normalizes JSON string array", fieldName: "mcp", hasArgs: true, args: []interface{}{"server.js", "--flag"}, wantArgs: []string{"server.js", "--flag"}, wantPresent: true},
		{name: "mcp copies typed string array", fieldName: "mcp", hasArgs: true, args: []string{"server.js", "--flag"}, wantArgs: []string{"server.js", "--flag"}, wantPresent: true},
		{name: "rpc uses same args contract", fieldName: "rpc", hasArgs: true, args: []interface{}{"--acp"}, wantArgs: []string{"--acp"}, wantPresent: true},
		{name: "registered field rejects string args", fieldName: "mcp", hasArgs: true, args: "server.js", wantErr: true},
		{name: "registered field rejects object args", fieldName: "mcp", hasArgs: true, args: map[string]interface{}{"0": "server.js"}, wantErr: true},
		{name: "registered field rejects numeric args", fieldName: "mcp", hasArgs: true, args: 12, wantErr: true},
		{name: "registered field rejects null args", fieldName: "mcp", hasArgs: true, args: nil, wantErr: true},
		{name: "registered field rejects mixed args array", fieldName: "mcp", hasArgs: true, args: []interface{}{"server.js", 2}, wantErr: true},
	}

	for _, mode := range modes {
		t.Run(mode.name, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					item := mode.buildInput(tt)

					err := mode.validate(tt.fieldName, item)

					assertArgsValidationResult(t, tt, item, err)
				})
			}
		})
	}
}

func TestArrayItemArgsValidationIgnoresUnregisteredFields(t *testing.T) {
	for _, mode := range []arrayItemValidationMode{
		{name: "create", buildInput: buildArrayItem, validate: validateArrayItemShape},
		{name: "update", buildInput: buildUpdatePatch, validate: validateArrayItemUpdateShape},
	} {
		t.Run(mode.name, func(t *testing.T) {
			input := mode.buildInput(argsFieldCase{
				fieldName:   "other",
				hasArgs:     true,
				args:        "left untouched",
				wantPresent: true,
			})

			err := mode.validate("other", input)

			if err != nil {
				t.Fatalf("unregistered field must pass args untouched: %v", err)
			}
			if got := input["args"]; got != "left untouched" {
				t.Fatalf("args = %#v, want untouched scalar", got)
			}
		})
	}
}

func TestValidateArrayItemShapeAliasField(t *testing.T) {
	tests := []struct {
		name    string
		alias   interface{}
		wantErr string
	}{
		{name: "accepts lower-case alias", alias: "/tool"},
		{name: "accepts upper-case alias", alias: "/Tool"},
		{name: "accepts alias with digits underscores and hyphens", alias: "/tool_1-alpha"},
		{name: "rejects missing alias", wantErr: "invalid alias"},
		{name: "rejects missing slash", alias: "tool", wantErr: "invalid alias"},
		{name: "rejects slash without command name", alias: "/", wantErr: "invalid alias"},
		{name: "rejects alias starting with digit", alias: "/1tool", wantErr: "invalid alias"},
		{name: "rejects alias starting with underscore", alias: "/_tool", wantErr: "invalid alias"},
		{name: "rejects alias starting with hyphen", alias: "/-tool", wantErr: "invalid alias"},
		{name: "rejects alias with whitespace", alias: "/bad alias", wantErr: "invalid alias"},
		{name: "rejects alias with nested path separator", alias: "/test/nested", wantErr: "invalid alias"},
		{name: "rejects alias with punctuation", alias: "/c++", wantErr: "invalid alias"},
		{name: "rejects alias with query marker", alias: "/query?", wantErr: "invalid alias"},
		{name: "rejects alias with equals sign", alias: "/query=value", wantErr: "invalid alias"},
		{name: "rejects non-ASCII alias", alias: "/查询", wantErr: "invalid alias"},
		{name: "rejects non-string alias", alias: 42, wantErr: "invalid alias"},
	}

	for _, fieldName := range registeredArrayItemFields() {
		t.Run(fieldName, func(t *testing.T) {
			for _, tt := range tests {
				t.Run(tt.name, func(t *testing.T) {
					item := buildAliasItem(fieldName, tt.alias)

					err := validateArrayItemShape(fieldName, item)

					assertValidationErrorContains(t, err, tt.wantErr)
				})
			}
		})
	}
}

func TestReservedCommandAliasSetInvariants(t *testing.T) {
	if len(reservedCommandAliases) == 0 {
		t.Fatal("reserved command alias set must not be empty")
	}

	for alias := range reservedCommandAliases {
		t.Run(alias, func(t *testing.T) {
			if alias != strings.ToLower(alias) {
				t.Fatalf("reserved alias must be lower-case: %s", alias)
			}
			if !aliasPattern.MatchString(alias) {
				t.Fatalf("reserved alias must use the public alias format: %s", alias)
			}
		})
	}
}

func TestSupportedRPCProtocolSetInvariants(t *testing.T) {
	if len(supportedRPCProtocols) == 0 {
		t.Fatal("supported RPC protocol set must not be empty")
	}

	for protocol := range supportedRPCProtocols {
		t.Run(protocol, func(t *testing.T) {
			if protocol != strings.ToLower(protocol) {
				t.Fatalf("supported RPC protocol must be lower-case: %s", protocol)
			}
			if strings.TrimSpace(protocol) != protocol || protocol == "" {
				t.Fatalf("supported RPC protocol must be non-empty and trimmed: %q", protocol)
			}
		})
	}
}

func TestValidateArrayItemShapeRejectsEveryReservedAlias(t *testing.T) {
	for _, fieldName := range registeredArrayItemFields() {
		t.Run(fieldName, func(t *testing.T) {
			for reservedAlias := range reservedCommandAliases {
				t.Run(reservedAlias, func(t *testing.T) {
					err := validateArrayItemShape(fieldName, buildAliasItem(fieldName, strings.ToUpper(reservedAlias)))

					assertValidationErrorContains(t, err, "built-in")
				})
			}
		})
	}
}

func registeredArrayItemFields() []string {
	return []string{"mcp", "rpc"}
}

func TestValidateArrayItemShapeRPCProtocol(t *testing.T) {
	for protocol := range supportedRPCProtocols {
		t.Run("accepts "+protocol, func(t *testing.T) {
			item := map[string]interface{}{"alias": "/tool", "protocol": protocol}

			err := validateArrayItemShape("rpc", item)

			assertValidationErrorContains(t, err, "")
		})
	}

	tests := []struct {
		name     string
		protocol interface{}
		wantErr  string
	}{
		{name: "rejects unsupported protocol", protocol: "telnet", wantErr: "invalid protocol"},
		{name: "rejects supported protocol with different case", protocol: "HTTP", wantErr: "invalid protocol"},
		{name: "rejects empty protocol", protocol: "", wantErr: "invalid protocol"},
		{name: "rejects non-string protocol", protocol: 12, wantErr: "invalid protocol"},
		{name: "rejects missing protocol", wantErr: "invalid protocol"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := map[string]interface{}{"alias": "/tool"}
			if tt.protocol != nil {
				item["protocol"] = tt.protocol
			}

			err := validateArrayItemShape("rpc", item)

			assertValidationErrorContains(t, err, tt.wantErr)
		})
	}
}

func buildAliasItem(fieldName string, alias interface{}) map[string]interface{} {
	item := map[string]interface{}{}
	if alias != nil {
		item["alias"] = alias
	}
	if fieldName == "rpc" {
		item["protocol"] = "http"
	}
	return item
}

func buildArrayItem(tt argsFieldCase) map[string]interface{} {
	item := buildAliasItem(tt.fieldName, "/tool")
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

func assertValidationErrorContains(t *testing.T, err error, wantErr string) {
	t.Helper()

	if wantErr == "" {
		if err != nil {
			t.Fatalf("unexpected validation error: %v", err)
		}
		return
	}

	if err == nil {
		t.Fatalf("expected validation error containing %q", wantErr)
	}
	if !isArrayItemValidationError(err) {
		t.Fatalf("expected array item validation error, got %T", err)
	}
	if !strings.Contains(err.Error(), wantErr) {
		t.Fatalf("validation error = %q, want substring %q", err.Error(), wantErr)
	}
}

func buildUpdatePatch(tt argsFieldCase) map[string]interface{} {
	patch := map[string]interface{}{}
	if tt.hasArgs {
		patch["args"] = tt.args
	}
	return patch
}

func TestArrayItemArgsValidationMutationSemantics(t *testing.T) {
	for _, mode := range []arrayItemValidationMode{
		{name: "create", buildInput: buildArrayItem, validate: validateArrayItemShape},
		{name: "update", buildInput: buildUpdatePatch, validate: validateArrayItemUpdateShape},
	} {
		t.Run(mode.name+"/invalid args are not mutated", func(t *testing.T) {
			originalArgs := []interface{}{"server.js", 2}
			item := mode.buildInput(argsFieldCase{
				fieldName: "mcp",
				hasArgs:   true,
				args:      originalArgs,
			})

			err := mode.validate("mcp", item)

			if err == nil {
				t.Fatal("expected validation error")
			}
			if got := item["args"]; !reflect.DeepEqual(got, originalArgs) {
				t.Fatalf("args mutated after validation failure: got %#v want %#v", got, originalArgs)
			}
		})

		t.Run(mode.name+"/typed string args are copied", func(t *testing.T) {
			originalArgs := []string{"server.js"}
			item := mode.buildInput(argsFieldCase{
				fieldName: "mcp",
				hasArgs:   true,
				args:      originalArgs,
			})

			err := mode.validate("mcp", item)

			if err != nil {
				t.Fatalf("unexpected validation error: %v", err)
			}
			normalized := item["args"].([]string)
			normalized[0] = "changed"
			if originalArgs[0] != "server.js" {
				t.Fatalf("typed args input was aliased instead of copied: %#v", originalArgs)
			}
		})
	}
}

func TestValidateArrayItemUpdateShapeAliasField(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		patch     map[string]interface{}
		wantErr   string
	}{
		{name: "mcp passes with no alias", fieldName: "mcp", patch: map[string]interface{}{}},
		{name: "rpc passes with no alias", fieldName: "rpc", patch: map[string]interface{}{}},
		{name: "mcp passes with other fields and no alias", fieldName: "mcp", patch: map[string]interface{}{"description": "x", "toolName": "t"}},
		{name: "mcp rejects valid-format alias", fieldName: "mcp", patch: map[string]interface{}{"alias": "/tool"}, wantErr: "alias cannot be changed"},
		{name: "rpc rejects valid-format alias", fieldName: "rpc", patch: map[string]interface{}{"alias": "/tool"}, wantErr: "alias cannot be changed"},
		{name: "mcp rejects alias combined with other fields", fieldName: "mcp", patch: map[string]interface{}{"alias": "/tool", "description": "x"}, wantErr: "alias cannot be changed"},
		{name: "mcp rejects alias with invalid format", fieldName: "mcp", patch: map[string]interface{}{"alias": "notvalid"}, wantErr: "alias cannot be changed"},
		{name: "mcp rejects alias with empty string", fieldName: "mcp", patch: map[string]interface{}{"alias": ""}, wantErr: "alias cannot be changed"},
		{name: "mcp rejects alias with non-string value", fieldName: "mcp", patch: map[string]interface{}{"alias": 42}, wantErr: "alias cannot be changed"},
		{name: "mcp rejects null alias", fieldName: "mcp", patch: map[string]interface{}{"alias": nil}, wantErr: "alias cannot be changed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateArrayItemUpdateShape(tt.fieldName, tt.patch)

			assertValidationErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestArrayItemCreateAndUpdateValidationContracts(t *testing.T) {
	tests := []struct {
		name       string
		fieldName  string
		patch      map[string]interface{}
		createErr  string
		updateErr  string
		createArgs []string
		updateArgs []string
	}{
		{
			name:      "mcp description is accepted on create and update",
			fieldName: "mcp",
			patch:     map[string]interface{}{"description": "updated"},
		},
		{
			name:      "rpc description update does not require protocol in patch",
			fieldName: "rpc",
			patch:     map[string]interface{}{"description": "updated"},
		},
		{
			name:       "mcp args normalization is shared",
			fieldName:  "mcp",
			patch:      map[string]interface{}{"args": []interface{}{"server.js", "--flag"}},
			createArgs: []string{"server.js", "--flag"},
			updateArgs: []string{"server.js", "--flag"},
		},
		{
			name:       "rpc supported protocol and args normalization are shared",
			fieldName:  "rpc",
			patch:      map[string]interface{}{"protocol": "http", "args": []interface{}{"--flag"}},
			createArgs: []string{"--flag"},
			updateArgs: []string{"--flag"},
		},
		{
			name:      "rpc unsupported protocol is rejected by both create and update",
			fieldName: "rpc",
			patch:     map[string]interface{}{"protocol": "telnet"},
			createErr: "invalid protocol",
			updateErr: "invalid protocol",
		},
		{
			name:      "invalid args are rejected by both create and update",
			fieldName: "mcp",
			patch:     map[string]interface{}{"args": "server.js"},
			createErr: "invalid args",
			updateErr: "invalid args",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			createItem := buildCreateItemFromPatch(tt.fieldName, tt.patch)
			updatePatch := cloneMap(tt.patch)

			createErr := validateArrayItemShape(tt.fieldName, createItem)
			updateErr := validateArrayItemUpdateShape(tt.fieldName, updatePatch)

			assertValidationErrorContains(t, createErr, tt.createErr)
			assertValidationErrorContains(t, updateErr, tt.updateErr)
			assertNormalizedArgs(t, createItem, tt.createArgs)
			assertNormalizedArgs(t, updatePatch, tt.updateArgs)
		})
	}
}

func buildCreateItemFromPatch(fieldName string, patch map[string]interface{}) map[string]interface{} {
	item := cloneMap(patch)
	item["alias"] = "/tool"
	if fieldName == "rpc" {
		if _, exists := item["protocol"]; !exists {
			item["protocol"] = "http"
		}
	}
	return item
}

func TestNormalizeArrayItemUpdateAlias(t *testing.T) {
	tests := []struct {
		name      string
		pathAlias string
		patch     map[string]interface{}
		wantErr   string
		wantAlias bool
	}{
		{name: "omitted alias leaves patch unchanged", pathAlias: "/tool", patch: map[string]interface{}{"description": "x"}},
		{name: "same alias is removed before partial validation", pathAlias: "/tool", patch: map[string]interface{}{"alias": "/tool", "description": "x"}},
		{name: "different alias rejected", pathAlias: "/tool", patch: map[string]interface{}{"alias": "/other"}, wantErr: "alias cannot be changed", wantAlias: true},
		{name: "non-string alias rejected", pathAlias: "/tool", patch: map[string]interface{}{"alias": 42}, wantErr: "alias cannot be changed", wantAlias: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := normalizeArrayItemUpdateAlias(tt.pathAlias, tt.patch)

			assertValidationErrorContains(t, err, tt.wantErr)
			_, hasAlias := tt.patch["alias"]
			if hasAlias != tt.wantAlias {
				t.Fatalf("alias presence = %v, want %v", hasAlias, tt.wantAlias)
			}
		})
	}
}

func cloneMap(source map[string]interface{}) map[string]interface{} {
	clone := make(map[string]interface{}, len(source))
	for key, value := range source {
		clone[key] = value
	}
	return clone
}

func assertNormalizedArgs(t *testing.T, item map[string]interface{}, want []string) {
	t.Helper()

	if want == nil {
		return
	}

	got, ok := item["args"].([]string)
	if !ok {
		t.Fatalf("args type = %T, want []string", item["args"])
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("args = %#v, want %#v", got, want)
	}
}

func TestValidateArrayItemUpdateShapeRPCProtocolWhenPresent(t *testing.T) {
	tests := []struct {
		name    string
		patch   map[string]interface{}
		wantErr string
	}{
		{name: "absent protocol passes", patch: map[string]interface{}{}},
		{name: "absent protocol with other fields passes", patch: map[string]interface{}{"description": "x"}},
		{name: "rejects unsupported protocol", patch: map[string]interface{}{"protocol": "telnet"}, wantErr: "invalid protocol"},
		{name: "rejects supported protocol with wrong case", patch: map[string]interface{}{"protocol": "HTTP"}, wantErr: "invalid protocol"},
		{name: "rejects empty string protocol", patch: map[string]interface{}{"protocol": ""}, wantErr: "invalid protocol"},
		{name: "rejects non-string protocol", patch: map[string]interface{}{"protocol": 12}, wantErr: "invalid protocol"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateArrayItemUpdateShape("rpc", tt.patch)

			assertValidationErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestValidateArrayItemUpdateShapeAllSupportedRPCProtocolsPass(t *testing.T) {
	for protocol := range supportedRPCProtocols {
		t.Run(protocol, func(t *testing.T) {
			err := validateArrayItemUpdateShape("rpc", map[string]interface{}{"protocol": protocol})

			if err != nil {
				t.Fatalf("supported protocol %q rejected: %v", protocol, err)
			}
		})
	}
}

func TestValidateArrayItemUpdateShapePassthroughForUnregisteredField(t *testing.T) {
	patches := []map[string]interface{}{
		{},
		{"alias": "/anything"},
		{"args": "not-an-array"},
		{"protocol": "telnet"},
	}
	for _, patch := range patches {
		if err := validateArrayItemUpdateShape("other", patch); err != nil {
			t.Fatalf("unregistered field must pass any patch: %v", err)
		}
	}
}
