package container

import (
	"backend-v2/internal/services/claude"
	"backend-v2/internal/services/email"
	"backend-v2/internal/services/freepik"
	"backend-v2/internal/services/midjourney"
	"backend-v2/internal/services/openai"
	"backend-v2/internal/services/perplexity"
	"backend-v2/internal/services/thumbnail"
	"backend-v2/internal/services/yandex"
	"backend-v2/internal/services/zoom"
)

/* ServiceContainer centralizes service instantiation for DRY/SOLID compliance */
type ServiceContainer struct {
	Email       email.Service
	Thumbnail   thumbnail.Service
	OpenAI      openai.Service
	Claude      claude.Service
	Perplexity  perplexity.Service
	Yandex      yandex.Service
	Midjourney  midjourney.Service
	Zoom        zoom.Service
	Freepik     freepik.Service
}

/* NewServiceContainer instantiates all services based on mock flag */
func NewServiceContainer(useMockServices bool) *ServiceContainer {
	return &ServiceContainer{
		Email:      selectService(useMockServices, email.NewNoopService, email.NewSMTPService),
		Thumbnail:  selectService(useMockServices, thumbnail.NewNoopService, thumbnail.NewProdService),
		OpenAI:     selectService(useMockServices, openai.NewNoopService, openai.NewProdService),
		Claude:     selectService(useMockServices, claude.NewNoopService, claude.NewProdService),
		Perplexity: selectService(useMockServices, perplexity.NewNoopService, perplexity.NewProdService),
		Yandex:     selectService(useMockServices, yandex.NewNoopService, yandex.NewProdService),
		Midjourney: selectService(useMockServices, midjourney.NewNoopService, midjourney.NewProdService),
		Zoom:       selectService(useMockServices, zoom.NewNoopService, zoom.NewProdService),
		Freepik:    selectService(useMockServices, freepik.NewNoopService, freepik.NewProdService),
	}
}

/* selectService returns noop or prod implementation based on flag */
func selectService[T any](useMock bool, noopFactory func() T, prodFactory func() T) T {
	if useMock {
		return noopFactory()
	}
	return prodFactory()
}
