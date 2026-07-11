package gateway

import (
	"backend-v2/internal/common/http"
	"backend-v2/internal/common/response"
	"bufio"
	"bytes"
	"time"

	nethttp "net/http"

	"github.com/gofiber/fiber/v2"
)

type Proxy struct {
	config           *Config
	httpClient       http.Client
	streamingClient  http.Client
	headerForwarder  *http.HeaderForwarder
	responseReader   *http.ResponseReader
	responseStreamer *http.ResponseStreamer
}

func NewProxy(config *Config) *Proxy {
	factory := http.NewClientFactory()
	return &Proxy{
		config:           config,
		httpClient:       factory.Create(300 * time.Second),
		streamingClient:  factory.CreateStreaming(),
		headerForwarder:  http.NewHeaderForwarder(),
		responseReader:   http.NewResponseReader(),
		responseStreamer: http.NewResponseStreamer(),
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

func (p *Proxy) ForwardStream(targetPath string) fiber.Handler {
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

		resp, err := p.streamingClient.Do(req)
		if err != nil {
			return response.InternalError(c, "Node.js backend unavailable")
		}

		c.Status(resp.StatusCode)
		p.headerForwarder.ForwardResponse(c, resp)

		if resp.StatusCode != nethttp.StatusOK {
			body, err := p.responseReader.ReadAll(resp)
			if err != nil {
				return response.InternalError(c, "Failed to read proxy response")
			}
			return c.Send(body)
		}

		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			_ = p.responseStreamer.Stream(resp, w)
		})

		return nil
	}
}
