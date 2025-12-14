package middlewares

import (
	"backend-v2/internal/common/response"

	"github.com/gofiber/fiber/v2"
)

type UserIDExtractor struct {
	routePolicy     RouteAccessPolicy
	errorClassifier *JWTErrorClassifier
	claimsExtractor *ClaimsExtractor
	contextStorage  *ContextStorage
}

func NewUserIDExtractor(
	routePolicy RouteAccessPolicy,
	errorClassifier *JWTErrorClassifier,
	claimsExtractor *ClaimsExtractor,
	contextStorage *ContextStorage,
) *UserIDExtractor {
	return &UserIDExtractor{
		routePolicy:     routePolicy,
		errorClassifier: errorClassifier,
		claimsExtractor: claimsExtractor,
		contextStorage:  contextStorage,
	}
}

func (m *UserIDExtractor) Handle(ctx *fiber.Ctx) error {
	if m.shouldSkipAuthentication(ctx) {
		return ctx.Next()
	}

	if err := m.handleJWTError(ctx); err != nil {
		return err
	}

	m.extractAndStoreUserData(ctx)

	return ctx.Next()
}

func (m *UserIDExtractor) shouldSkipAuthentication(ctx *fiber.Ctx) bool {
	currentPath := ctx.Path()
	return m.routePolicy.IsPublicRoute(currentPath)
}

func (m *UserIDExtractor) handleJWTError(ctx *fiber.Ctx) error {
	jwtError := m.contextStorage.GetJWTError(ctx)

	if m.errorClassifier.IsAuthenticationRequired(jwtError) {
		return response.Unauthorized(ctx, jwtError)
	}

	if m.errorClassifier.HasNoToken(jwtError) {
		m.contextStorage.ClearUserID(ctx)
	}

	return nil
}

func (m *UserIDExtractor) extractAndStoreUserData(ctx *fiber.Ctx) {
	claims, exists := m.contextStorage.GetAuthClaims(ctx)
	if !exists {
		return
	}

	m.storeUserID(ctx, claims)
	m.storeRoles(ctx, claims)
}

func (m *UserIDExtractor) storeUserID(ctx *fiber.Ctx, claims map[string]interface{}) {
	userID := m.claimsExtractor.ExtractUserID(claims)
	if userID != "" {
		m.contextStorage.StoreUserID(ctx, userID)
	}
}

func (m *UserIDExtractor) storeRoles(ctx *fiber.Ctx, claims map[string]interface{}) {
	roles := m.claimsExtractor.ExtractRoles(claims)
	if roles != nil {
		m.contextStorage.StoreRoles(ctx, roles)
	}
}
