package progress

import (
	"backend-v2/internal/modules/gateway"
	"bufio"
	"io"
	"net/http"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	config *gateway.Config
}

func NewController() *Controller {
	return &Controller{
		config: gateway.NewConfig(),
	}
}

func (c *Controller) Stream(ctx *fiber.Ctx) error {
	nodeURL := c.config.NodeJSBackendURL + "/api/v1/progress/stream"

	req, err := http.NewRequest("GET", nodeURL, nil)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).SendString("Proxy setup failed")
	}

	req.Header.Set("Accept", "text/event-stream")
	if auth := ctx.Get("Authorization"); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	client := &http.Client{Timeout: 0}
	resp, err := client.Do(req)
	if err != nil {
		return ctx.Status(fiber.StatusBadGateway).SendString("Node.js backend unavailable")
	}
	defer resp.Body.Close()

	ctx.Set("Content-Type", "text/event-stream")
	ctx.Set("Cache-Control", "no-cache")
	ctx.Set("Connection", "keep-alive")
	ctx.Set("Transfer-Encoding", "chunked")

	ctx.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		reader := bufio.NewReader(resp.Body)
		for {
			line, err := reader.ReadBytes('\n')
			if err != nil {
				if err != io.EOF {
					return
				}
				return
			}
			if _, wErr := w.Write(line); wErr != nil {
				return
			}
			w.Flush()
		}
	})

	return nil
}
