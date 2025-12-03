package gateway

import (
	"backend-v2/internal/common/http"
	"backend-v2/internal/common/response"
	"bytes"
	"time"

	"github.com/gofiber/fiber/v2"
	nethttp "net/http"
)

type Proxy struct {
	config         *Config
	httpClient     http.Client
	headerForwarder *http.HeaderForwarder
	responseReader  *http.ResponseReader
}

func NewProxy(config *Config) *Proxy {
	factory := http.NewClientFactory()
	return &Proxy{
		config:          config,
		httpClient:      factory.Create(300 * time.Second),
		headerForwarder: http.NewHeaderForwarder(),
		responseReader:  http.NewResponseReader(),
	}
}

func (p *Proxy) Forward(targetPath string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		targetURL := p.config.BuildURL(targetPath)
		
		if len(c.Request().URI().QueryString()) > 0 {
			targetURL += "?" + string(c.Request().URI().QueryString())
		}

		req, err := nethttp.NewRequest(
			c.Method(),
			targetURL,
			bytes.NewReader(c.Body()),
		)
		if err != nil {
			return response.InternalError(c, "Failed to create proxy request")
		}

		p.headerForwarder.ForwardRequest(c, req)

		resp, err := p.httpClient.Do(req)
		if err != nil {
			return response.InternalError(c, "Node.js backend unavailable")
		}

		c.Status(resp.StatusCode)
		p.headerForwarder.ForwardResponse(c, resp)

		body, err := p.responseReader.ReadAll(resp)
		if err != nil {
			return response.InternalError(c, "Failed to read proxy response")
		}

		return c.Send(body)
	}
}
