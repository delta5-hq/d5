package middlewares

import (
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type ClaimsExtractor struct{}

func NewClaimsExtractor() *ClaimsExtractor {
	return &ClaimsExtractor{}
}

func (e *ClaimsExtractor) ExtractUserID(claims jwt.MapClaims) string {
	if userID := e.extractFromSubject(claims); userID != "" {
		return userID
	}
	return e.extractFromUserIDField(claims)
}

func (e *ClaimsExtractor) ExtractRoles(claims jwt.MapClaims) []string {
	rolesInterface, exists := claims["roles"].([]interface{})
	if !exists {
		return nil
	}

	return e.convertToStringSlice(rolesInterface)
}

func (e *ClaimsExtractor) extractFromSubject(claims jwt.MapClaims) string {
	subject, ok := claims["sub"].(string)
	if ok {
		return subject
	}
	return ""
}

func (e *ClaimsExtractor) extractFromUserIDField(claims jwt.MapClaims) string {
	userID, ok := claims["userId"].(string)
	if ok {
		return userID
	}
	return ""
}

func (e *ClaimsExtractor) convertToStringSlice(items []interface{}) []string {
	result := make([]string, 0, len(items))
	for _, item := range items {
		if str, ok := item.(string); ok {
			result = append(result, str)
		}
	}
	return result
}

type ContextStorage struct{}

func NewContextStorage() *ContextStorage {
	return &ContextStorage{}
}

func (s *ContextStorage) StoreUserID(ctx *fiber.Ctx, userID string) {
	ctx.Locals("userId", userID)
}

func (s *ContextStorage) StoreRoles(ctx *fiber.Ctx, roles []string) {
	ctx.Locals("roles", roles)
}

func (s *ContextStorage) ClearUserID(ctx *fiber.Ctx) {
	ctx.Locals("userId", nil)
}

func (s *ContextStorage) GetJWTError(ctx *fiber.Ctx) string {
	errValue := ctx.Locals("jwtOriginalError")
	if errValue == nil {
		return JWTErrorNone
	}

	errMsg, ok := errValue.(string)
	if !ok {
		return JWTErrorNone
	}

	return errMsg
}

func (s *ContextStorage) GetAuthClaims(ctx *fiber.Ctx) (jwt.MapClaims, bool) {
	authValue := ctx.Locals("auth")
	if authValue == nil {
		return nil, false
	}

	claims, ok := authValue.(jwt.MapClaims)
	return claims, ok
}
