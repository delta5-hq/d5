package middlewares

import (
	"backend-v2/internal/config"
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware(c *fiber.Ctx) error {
	var tokenStr string

	/* Cookie takes precedence over Authorization header */
	if cookie := c.Cookies("auth"); cookie != "" {
		/* Reject cookie with Bearer prefix */
		if strings.HasPrefix(cookie, "Bearer ") {
			c.Locals("jwtOriginalError", "invalid token format in cookie")
			return c.Next()
		}
		/* Reject multiple auth cookies */
		if strings.Contains(c.Get("Cookie"), "auth=") && strings.Count(c.Get("Cookie"), "auth=") > 1 {
			c.Locals("jwtOriginalError", "multiple auth cookies not allowed")
			return c.Next()
		}
		/* Reject URL encoded tokens in cookies - check raw cookie header */
		rawCookie := c.Get("Cookie")
		if strings.Contains(rawCookie, "auth=") {
			/* Extract auth cookie value from raw header */
			authStart := strings.Index(rawCookie, "auth=") + 5
			authEnd := strings.Index(rawCookie[authStart:], ";")
			if authEnd == -1 {
				authEnd = len(rawCookie) - authStart
			}
			rawAuthValue := rawCookie[authStart : authStart+authEnd]
			if strings.Contains(rawAuthValue, "%") {
				c.Locals("jwtOriginalError", "url encoded tokens not allowed")
				return c.Next()
			}
		}
		tokenStr = cookie
	} else if authHeader := c.Get("Authorization"); authHeader != "" {
		/* Reject multiple authorization headers (comma-separated) */
		if strings.Contains(authHeader, ",") {
			c.Locals("jwtOriginalError", "multiple authorization headers not allowed")
			return c.Next()
		}
		/* Check if multiple Authorization headers were sent (Fiber returns first one only) */
		/* GetReqHeaders returns map[string][]string for multi-value headers */
		reqHeaders := c.GetReqHeaders()
		if authHeaders, exists := reqHeaders["Authorization"]; exists && len(authHeaders) > 1 {
			c.Locals("jwtOriginalError", "multiple authorization headers not allowed")
			return c.Next()
		}
		/* Strict Bearer token format validation */
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 {
			c.Locals("jwtOriginalError", "invalid authorization header format")
			return c.Next()
		}
		/* Case-sensitive Bearer check */
		if parts[0] != "Bearer" {
			c.Locals("jwtOriginalError", "invalid authorization header format")
			return c.Next()
		}
		tokenStr = parts[1]
		/* Reject URL encoded tokens */
		if strings.Contains(tokenStr, "%") {
			c.Locals("jwtOriginalError", "url encoded tokens not allowed")
			return c.Next()
		}
	}

	if tokenStr == "" {
		c.Locals("jwtOriginalError", "jwt must be provided")
		return c.Next()
	}

	/* Strict JWT parsing with algorithm validation */
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		/* Enforce HS256 algorithm only */
		if t.Method.Alg() != "HS256" {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.JwtSecret), nil
	})

	if err != nil {
		c.Locals("jwtOriginalError", err.Error())
		return c.Next()
	}

	if !token.Valid {
		c.Locals("jwtOriginalError", "token is invalid")
		return c.Next()
	}

	/* Validate token claims */
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		c.Locals("jwtOriginalError", "invalid token claims")
		return c.Next()
	}

	/* Expiration claim is required */
	exp, expExists := claims["exp"].(float64)
	if !expExists {
		c.Locals("jwtOriginalError", "token missing expiration")
		return c.Next()
	}

	/* Validate expiration time */
	nowUnix := time.Now().Unix()
	expUnix := int64(exp)
	if nowUnix > expUnix {
		c.Locals("jwtOriginalError", "token is expired")
		return c.Next()
	}

	/* Reject excessively long expiration (>1 year) */
	oneYearFromNow := time.Now().Add(365 * 24 * time.Hour).Unix()
	if expUnix > oneYearFromNow {
		c.Locals("jwtOriginalError", "token expiration too long")
		return c.Next()
	}

	/* Validate issued at time */
	if iat, ok := claims["iat"].(float64); ok {
		if nowUnix < int64(iat) {
			c.Locals("jwtOriginalError", "token used before issued")
			return c.Next()
		}
	}

	/* Validate subject exists and is not empty */
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		c.Locals("jwtOriginalError", "invalid token subject")
		return c.Next()
	}

	/* Reject SQL injection attempts in subject */
	if strings.Contains(sub, "'") || strings.Contains(sub, "\"") || strings.Contains(sub, "--") || strings.Contains(sub, ";") {
		c.Locals("jwtOriginalError", "invalid token subject")
		return c.Next()
	}

	/* Reject XSS attempts in subject */
	if strings.Contains(sub, "<") || strings.Contains(sub, ">") || strings.Contains(sub, "script") {
		c.Locals("jwtOriginalError", "invalid token subject")
		return c.Next()
	}

	/* Validate roles if present */
	if rolesRaw, rolesExist := claims["roles"]; rolesExist {
		/* Roles must be array */
		roles, rolesIsArray := rolesRaw.([]interface{})
		if !rolesIsArray {
			c.Locals("jwtOriginalError", "invalid roles format")
			return c.Next()
		}

		/* Validate each role */
		validRoles := map[string]bool{
			"administrator": true,
			"subscriber":    true,
			"customer":      true,
			"sync":          true,
		}

		for _, roleRaw := range roles {
			role, isString := roleRaw.(string)
			if !isString || !validRoles[role] {
				c.Locals("jwtOriginalError", "invalid role")
				return c.Next()
			}
		}
	}

	/* Validate limits if present */
	if limitsRaw, limitsExist := claims["limits"]; limitsExist {
		if limits, ok := limitsRaw.(map[string]interface{}); ok {
			for key, val := range limits {
				if numVal, ok := val.(float64); ok {
					if numVal < 0 {
						c.Locals("jwtOriginalError", "invalid limit value")
						return c.Next()
					}
				}
				_ = key
			}
		}
	}

	/* Validate top-level limit claims */
	if limitWorkflows, ok := claims["limitWorkflows"].(float64); ok {
		if limitWorkflows < 0 {
			c.Locals("jwtOriginalError", "invalid limit value")
			return c.Next()
		}
	}
	if limitNodes, ok := claims["limitNodes"].(float64); ok {
		if limitNodes < 0 {
			c.Locals("jwtOriginalError", "invalid limit value")
			return c.Next()
		}
	}

	c.Locals("auth", claims)

	/* Extract and set userID from subject claim */
	if sub, ok := claims["sub"].(string); ok {
		c.Locals("userId", sub)
	}

	return c.Next()
}
