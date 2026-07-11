package integration

import (
	"fmt"
	"regexp"
	"strings"
)

type arrayItemValidationError struct {
	message string
}

func (e arrayItemValidationError) Error() string {
	return e.message
}

func isArrayItemValidationError(err error) bool {
	_, ok := err.(arrayItemValidationError)
	return ok
}

type arrayItemValidator func(map[string]interface{}) error

var arrayItemValidators = map[string]arrayItemValidator{
	"mcp": validateMCPArrayItem,
	"rpc": validateRPCArrayItem,
}

var aliasPattern = regexp.MustCompile(`^/[A-Za-z][A-Za-z0-9_-]*$`)

var reservedCommandAliases = newStringSet(
	"/case",
	"/chat",
	"/chatgpt",
	"/claude",
	"/completion",
	"/custom",
	"/deepseek",
	"/download",
	"/ext",
	"/foreach",
	"/instruct",
	"/mcp",
	"/memorize",
	"/outline",
	"/perplexity",
	"/qwen",
	"/reason",
	"/refine",
	"/scholar",
	"/steps",
	"/summarize",
	"/switch",
	"/validate",
	"/web",
	"/yandex",
	"/yandexgpt",
)

var supportedRPCProtocols = newStringSet("acp-local", "http", "ssh")

func newStringSet(values ...string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		set[value] = struct{}{}
	}
	return set
}

func validateArrayItemShape(fieldName string, item map[string]interface{}) error {
	validator, exists := arrayItemValidators[fieldName]
	if !exists {
		return nil
	}
	return validator(item)
}

func validateMCPArrayItem(item map[string]interface{}) error {
	if err := validateAliasField(item); err != nil {
		return err
	}
	return validateCommandArgsField(item)
}

func validateRPCArrayItem(item map[string]interface{}) error {
	if err := validateAliasField(item); err != nil {
		return err
	}
	if err := validateRPCProtocol(item); err != nil {
		return err
	}
	return validateCommandArgsField(item)
}

func validateAliasField(item map[string]interface{}) error {
	value, exists := item["alias"]
	if !exists {
		return arrayItemValidationError{message: "invalid alias: expected /name with letters, numbers, underscores, or hyphens"}
	}

	alias, ok := value.(string)
	if !ok || !aliasPattern.MatchString(alias) {
		return arrayItemValidationError{message: "invalid alias: expected /name with letters, numbers, underscores, or hyphens"}
	}

	if _, reserved := reservedCommandAliases[strings.ToLower(alias)]; reserved {
		return arrayItemValidationError{message: "invalid alias: built-in command aliases are reserved"}
	}

	return nil
}

func validateRPCProtocol(item map[string]interface{}) error {
	value, exists := item["protocol"]
	if !exists {
		return arrayItemValidationError{message: "invalid protocol: expected one of ssh, http, acp-local"}
	}

	protocol, ok := value.(string)
	if !ok {
		return arrayItemValidationError{message: "invalid protocol: expected string"}
	}

	if _, supported := supportedRPCProtocols[protocol]; !supported {
		return arrayItemValidationError{message: "invalid protocol: expected one of ssh, http, acp-local"}
	}

	return nil
}

func validateCommandArgsField(item map[string]interface{}) error {
	value, exists := item["args"]
	if !exists {
		return nil
	}

	args, err := normalizeStringArray(value)
	if err != nil {
		return arrayItemValidationError{message: "invalid args: expected array of strings"}
	}

	item["args"] = args
	return nil
}

func normalizeStringArray(value interface{}) ([]string, error) {
	switch typed := value.(type) {
	case []string:
		return append([]string(nil), typed...), nil
	case []interface{}:
		result := make([]string, 0, len(typed))
		for _, item := range typed {
			text, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("non-string item")
			}
			result = append(result, text)
		}
		return result, nil
	default:
		return nil, fmt.Errorf("not an array")
	}
}

type arrayItemUpdateValidator func(map[string]interface{}) error

var arrayItemUpdateValidators = map[string]arrayItemUpdateValidator{
	"mcp": validateMCPArrayItemUpdate,
	"rpc": validateRPCArrayItemUpdate,
}

func validateArrayItemUpdateShape(fieldName string, updates map[string]interface{}) error {
	validator, exists := arrayItemUpdateValidators[fieldName]
	if !exists {
		return nil
	}
	return validator(updates)
}

func validateMCPArrayItemUpdate(updates map[string]interface{}) error {
	if err := validateAliasAbsent(updates); err != nil {
		return err
	}
	return validateCommandArgsField(updates)
}

func validateRPCArrayItemUpdate(updates map[string]interface{}) error {
	if err := validateAliasAbsent(updates); err != nil {
		return err
	}
	if err := validateRPCProtocolIfPresent(updates); err != nil {
		return err
	}
	return validateCommandArgsField(updates)
}

func validateAliasAbsent(updates map[string]interface{}) error {
	if _, exists := updates["alias"]; exists {
		return arrayItemValidationError{message: "alias cannot be changed after creation"}
	}
	return nil
}

func validateRPCProtocolIfPresent(updates map[string]interface{}) error {
	value, exists := updates["protocol"]
	if !exists {
		return nil
	}
	protocol, ok := value.(string)
	if !ok {
		return arrayItemValidationError{message: "invalid protocol: expected string"}
	}
	if _, supported := supportedRPCProtocols[protocol]; !supported {
		return arrayItemValidationError{message: "invalid protocol: expected one of ssh, http, acp-local"}
	}
	return nil
}
