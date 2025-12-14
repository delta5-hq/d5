package middlewares

var (
	publicAuthRoutes = []string{
		"/auth/signup",
		"/auth/login",
		"/auth/login-jwt",
		"/auth/logout",
		"/auth/refresh",
		"/auth/forgot-password",
		"/auth/reset-password",
		"/auth/check-reset-token",
	}
)

func CreateUserIDExtractor() *UserIDExtractor {
	routePolicy := NewPublicRouteAccessPolicy(publicAuthRoutes)
	errorClassifier := NewJWTErrorClassifier()
	claimsExtractor := NewClaimsExtractor()
	contextStorage := NewContextStorage()

	return NewUserIDExtractor(
		routePolicy,
		errorClassifier,
		claimsExtractor,
		contextStorage,
	)
}
