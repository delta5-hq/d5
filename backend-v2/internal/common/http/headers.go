package http

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type HeaderForwarder struct{}

func NewHeaderForwarder() *HeaderForwarder {
	return &HeaderForwarder{}
}

func (f *HeaderForwarder) ForwardRequest(fiberCtx *fiber.Ctx, httpReq *http.Request) {
	fiberCtx.Request().Header.VisitAll(func(key, value []byte) {
		httpReq.Header.Set(string(key), string(value))
	})
}

func (f *HeaderForwarder) ForwardResponse(fiberCtx *fiber.Ctx, httpResp *http.Response) {
	for key, values := range httpResp.Header {
		for _, value := range values {
			fiberCtx.Set(key, value)
		}
	}
}
