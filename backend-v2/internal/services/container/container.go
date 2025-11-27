package container

import (
	"backend-v2/internal/services/email"
	"backend-v2/internal/services/freepik"
	"backend-v2/internal/services/llmproxy"
	"backend-v2/internal/services/midjourney"
	"backend-v2/internal/services/thumbnail"
	"backend-v2/internal/services/zoom"

	"github.com/qiniu/qmgo"
)

/* ServiceContainer centralizes service instantiation for DRY/SOLID compliance */
type ServiceContainer struct {
	Email      email.Service
	Thumbnail  thumbnail.Service
	Midjourney midjourney.Service
	Zoom       zoom.Service
	Freepik    freepik.Service
	LLMProxy   llmproxy.Service
}

/* NewServiceContainer instantiates all services based on mock flag */
func NewServiceContainer(useMockServices bool, db *qmgo.Database) *ServiceContainer {
	return &ServiceContainer{
		Email:      selectService(useMockServices, email.NewNoopService, email.NewSMTPService),
		Thumbnail:  selectService(useMockServices, thumbnail.NewNoopService, thumbnail.NewProdService),
		Midjourney: selectService(useMockServices, midjourney.NewNoopService, midjourney.NewProdService),
		Zoom:       selectService(useMockServices, zoom.NewNoopService, zoom.NewProdService),
		Freepik:    selectService(useMockServices, freepik.NewNoopService, freepik.NewProdService),
		LLMProxy:   selectService(useMockServices, llmproxy.NewNoopService, llmproxy.NewProdService),
	}
}

/* selectService returns noop or prod implementation based on flag */
func selectService[T any](useMock bool, noopFactory func() T, prodFactory func() T) T {
	if useMock {
		return noopFactory()
	}
	return prodFactory()
}
