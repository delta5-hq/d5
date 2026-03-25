package integration

const SecretRedactionSentinel = "***"

func isSentinelValue(value interface{}) bool {
	str, ok := value.(string)
	return ok && str == SecretRedactionSentinel
}
