package integration

import "fmt"

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
	"mcp": validateCommandArgsField,
	"rpc": validateCommandArgsField,
}

func validateArrayItemShape(fieldName string, item map[string]interface{}) error {
	validator, exists := arrayItemValidators[fieldName]
	if !exists {
		return nil
	}
	return validator(item)
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
