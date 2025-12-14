package middlewares

type RouteAccessPolicy interface {
	IsPublicRoute(path string) bool
}

type PublicRouteAccessPolicy struct {
	publicPaths []string
}

func NewPublicRouteAccessPolicy(publicPaths []string) *PublicRouteAccessPolicy {
	return &PublicRouteAccessPolicy{
		publicPaths: publicPaths,
	}
}

func (p *PublicRouteAccessPolicy) IsPublicRoute(path string) bool {
	for _, publicPath := range p.publicPaths {
		if containsPath(path, publicPath) {
			return true
		}
	}
	return false
}

func containsPath(fullPath, pathSegment string) bool {
	return len(fullPath) >= len(pathSegment) &&
		fullPath[len(fullPath)-len(pathSegment):] == pathSegment
}
