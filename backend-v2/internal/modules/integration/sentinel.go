package integration

const SecretRedactionSentinel = "***"

func isSentinelValue(value interface{}) bool {
	str, ok := value.(string)
	return ok && str == SecretRedactionSentinel
}

func isSentinelMap(value interface{}) bool {
	mapVal, ok := value.(map[string]interface{})
	if !ok {
		return false
	}

	if len(mapVal) != 1 {
		return false
	}

	sentinel, exists := mapVal[SecretRedactionSentinel]
	if !exists {
		return false
	}

	sentinelStr, ok := sentinel.(string)
	return ok && sentinelStr == SecretRedactionSentinel
}
