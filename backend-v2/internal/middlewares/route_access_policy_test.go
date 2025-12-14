package middlewares_test

import (
	"backend-v2/internal/middlewares"
	"testing"
)

func TestPublicRouteAccessPolicy_IsPublicRoute_ExactMatch(t *testing.T) {
	tests := []struct {
		name         string
		publicPaths  []string
		requestPath  string
		expectPublic bool
	}{
		{
			name:         "exact match - signup",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "/api/v2/auth/signup",
			expectPublic: true,
		},
		{
			name:         "exact match - login",
			publicPaths:  []string{"/auth/login"},
			requestPath:  "/api/v2/auth/login",
			expectPublic: true,
		},
		{
			name:         "no match - protected route",
			publicPaths:  []string{"/auth/signup", "/auth/login"},
			requestPath:  "/api/v2/workflow",
			expectPublic: false,
		},
		{
			name:         "partial match - not public",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "/api/v2/auth/signup/extra",
			expectPublic: false,
		},
		{
			name:         "empty public paths",
			publicPaths:  []string{},
			requestPath:  "/api/v2/auth/signup",
			expectPublic: false,
		},
		{
			name:         "multiple public paths - first matches",
			publicPaths:  []string{"/auth/signup", "/auth/login", "/auth/refresh"},
			requestPath:  "/api/v2/auth/signup",
			expectPublic: true,
		},
		{
			name:         "multiple public paths - last matches",
			publicPaths:  []string{"/auth/signup", "/auth/login", "/auth/refresh"},
			requestPath:  "/api/v2/auth/refresh",
			expectPublic: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := middlewares.NewPublicRouteAccessPolicy(tt.publicPaths)
			result := policy.IsPublicRoute(tt.requestPath)

			if result != tt.expectPublic {
				t.Errorf("IsPublicRoute(%q) = %v, want %v", tt.requestPath, result, tt.expectPublic)
			}
		})
	}
}

func TestPublicRouteAccessPolicy_IsPublicRoute_CaseSensitivity(t *testing.T) {
	tests := []struct {
		name         string
		publicPath   string
		requestPath  string
		expectPublic bool
	}{
		{
			name:         "lowercase match",
			publicPath:   "/auth/signup",
			requestPath:  "/api/v2/auth/signup",
			expectPublic: true,
		},
		{
			name:         "uppercase mismatch",
			publicPath:   "/auth/signup",
			requestPath:  "/api/v2/AUTH/SIGNUP",
			expectPublic: false,
		},
		{
			name:         "mixed case mismatch",
			publicPath:   "/auth/signup",
			requestPath:  "/api/v2/Auth/Signup",
			expectPublic: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := middlewares.NewPublicRouteAccessPolicy([]string{tt.publicPath})
			result := policy.IsPublicRoute(tt.requestPath)

			if result != tt.expectPublic {
				t.Errorf("IsPublicRoute(%q) = %v, want %v", tt.requestPath, result, tt.expectPublic)
			}
		})
	}
}

func TestPublicRouteAccessPolicy_IsPublicRoute_EdgeCases(t *testing.T) {
	tests := []struct {
		name         string
		publicPaths  []string
		requestPath  string
		expectPublic bool
	}{
		{
			name:         "empty request path",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "",
			expectPublic: false,
		},
		{
			name:         "root path",
			publicPaths:  []string{"/"},
			requestPath:  "/",
			expectPublic: true,
		},
		{
			name:         "path with trailing slash - public has trailing",
			publicPaths:  []string{"/auth/signup/"},
			requestPath:  "/api/v2/auth/signup/",
			expectPublic: true,
		},
		{
			name:         "path with trailing slash - request has trailing",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "/api/v2/auth/signup/",
			expectPublic: false,
		},
		{
			name:         "path with query parameters",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "/api/v2/auth/signup?param=value",
			expectPublic: false,
		},
		{
			name:         "very long path",
			publicPaths:  []string{"/auth/signup"},
			requestPath:  "/api/v2/very/long/nested/path/structure/auth/signup",
			expectPublic: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := middlewares.NewPublicRouteAccessPolicy(tt.publicPaths)
			result := policy.IsPublicRoute(tt.requestPath)

			if result != tt.expectPublic {
				t.Errorf("IsPublicRoute(%q) = %v, want %v", tt.requestPath, result, tt.expectPublic)
			}
		})
	}
}

func TestPublicRouteAccessPolicy_IsPublicRoute_AllAuthRoutes(t *testing.T) {
	authRoutes := []string{
		"/auth/signup",
		"/auth/login",
		"/auth/login-jwt",
		"/auth/logout",
		"/auth/refresh",
		"/auth/forgot-password",
		"/auth/reset-password",
		"/auth/check-reset-token",
	}

	policy := middlewares.NewPublicRouteAccessPolicy(authRoutes)

	for _, route := range authRoutes {
		t.Run(route, func(t *testing.T) {
			fullPath := "/api/v2" + route
			result := policy.IsPublicRoute(fullPath)

			if !result {
				t.Errorf("IsPublicRoute(%q) = false, want true for auth route", fullPath)
			}
		})
	}
}

func TestPublicRouteAccessPolicy_IsPublicRoute_ProtectedRoutes(t *testing.T) {
	authRoutes := []string{"/auth/signup", "/auth/login"}
	policy := middlewares.NewPublicRouteAccessPolicy(authRoutes)

	protectedRoutes := []string{
		"/api/v2/workflow",
		"/api/v2/template",
		"/api/v2/user",
		"/api/v2/sync",
		"/api/v2/llmvector",
		"/api/v2/integration",
		"/api/v2/macro",
		"/api/v2/statistics",
	}

	for _, route := range protectedRoutes {
		t.Run(route, func(t *testing.T) {
			result := policy.IsPublicRoute(route)

			if result {
				t.Errorf("IsPublicRoute(%q) = true, want false for protected route", route)
			}
		})
	}
}

func BenchmarkPublicRouteAccessPolicy_IsPublicRoute(b *testing.B) {
	authRoutes := []string{
		"/auth/signup",
		"/auth/login",
		"/auth/login-jwt",
		"/auth/logout",
		"/auth/refresh",
		"/auth/forgot-password",
		"/auth/reset-password",
		"/auth/check-reset-token",
	}
	policy := middlewares.NewPublicRouteAccessPolicy(authRoutes)
	path := "/api/v2/auth/signup"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		policy.IsPublicRoute(path)
	}
}
