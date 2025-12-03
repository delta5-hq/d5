package gateway

import (
	"github.com/gofiber/fiber/v2"
)

type RouteRegistry struct {
	proxy *Proxy
}

func NewRouteRegistry(proxy *Proxy) *RouteRegistry {
	if proxy == nil {
		panic("proxy cannot be nil")
	}
	return &RouteRegistry{
		proxy: proxy,
	}
}

func (r *RouteRegistry) RegisterNodeJSRoutes(router fiber.Router) {
	r.registerExecuteRoutes(router)
	r.registerScrapingRoutes(router)
	r.registerExternalAPIRoutes(router)
}

func (r *RouteRegistry) registerExecuteRoutes(router fiber.Router) {
	router.All("/execute", r.proxy.Forward("/execute"))
}

func (r *RouteRegistry) registerScrapingRoutes(router fiber.Router) {
	integrationGroup := router.Group("/integration")
	integrationGroup.Post("/scrape_v2", r.proxy.Forward("/integration/scrape_v2"))
	integrationGroup.Post("/scrape_files", r.proxy.Forward("/integration/scrape_files"))
}

func (r *RouteRegistry) registerExternalAPIRoutes(router fiber.Router) {
	integrationGroup := router.Group("/integration")
	integrationGroup.Post("/translate", r.proxy.Forward("/integration/translate"))
	integrationGroup.Get("/search", r.proxy.Forward("/integration/search"))
	integrationGroup.Post("/downloadImage", r.proxy.Forward("/integration/downloadImage"))
	integrationGroup.Post("/images/generations", r.proxy.Forward("/integration/images/generations"))
}
