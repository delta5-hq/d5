package integration

type ArrayFieldMetadata struct {
	FieldName        string
	AliasFieldName   string
	AllowedProtocols []string
}

var registeredArrayFields = map[string]ArrayFieldMetadata{
	"mcp": {
		FieldName:        "mcp",
		AliasFieldName:   "alias",
		AllowedProtocols: []string{"stdio", "streamable-http"},
	},
	"rpc": {
		FieldName:        "rpc",
		AliasFieldName:   "alias",
		AllowedProtocols: []string{"ssh", "http", "acp-local"},
	},
}

func IsArrayFieldRegistered(fieldName string) bool {
	_, exists := registeredArrayFields[fieldName]
	return exists
}
