package progress

import (
	"bufio"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
)

type ProgressEvent struct {
	Type      string `json:"type"`
	NodeID    string `json:"nodeId,omitempty"`
	State     string `json:"state,omitempty"`
	Timestamp int64  `json:"timestamp"`
}

type Controller struct{}

func NewController() *Controller {
	return &Controller{}
}

func (c *Controller) Stream(ctx *fiber.Ctx) error {
	ctx.Set("Content-Type", "text/event-stream")
	ctx.Set("Cache-Control", "no-cache")
	ctx.Set("Connection", "keep-alive")
	ctx.Set("Transfer-Encoding", "chunked")
	ctx.Set("Access-Control-Allow-Origin", "*")

	ctx.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		connEvent := ProgressEvent{
			Type:      "connected",
			Timestamp: time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(connEvent)
		fmt.Fprintf(w, "data: %s\n\n", data)
		w.Flush()

		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			heartbeat := ProgressEvent{
				Type:      "heartbeat",
				Timestamp: time.Now().UnixMilli(),
			}
			data, _ := json.Marshal(heartbeat)
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return
			}
			if err := w.Flush(); err != nil {
				return
			}
		}
	})

	return nil
}
