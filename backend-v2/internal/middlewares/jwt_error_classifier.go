package middlewares

const (
	JWTErrorNone             = ""
	JWTErrorMissingToken     = "jwt must be provided"
	JWTErrorInvalidSignature = "signature is invalid"
)

type JWTErrorClassifier struct{}

func NewJWTErrorClassifier() *JWTErrorClassifier {
	return &JWTErrorClassifier{}
}

func (c *JWTErrorClassifier) IsAuthenticationRequired(errorMessage string) bool {
	return errorMessage != JWTErrorNone &&
		errorMessage != JWTErrorMissingToken
}

func (c *JWTErrorClassifier) HasNoToken(errorMessage string) bool {
	return errorMessage == JWTErrorMissingToken
}
