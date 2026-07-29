package checkedlog

import (
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

func RequestLogger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		started := time.Now()
		err := c.Next()
		logErr := err
		if err != nil {
			logErr = handleRequestError(c, err)
		}
		_, _ = stdoutEmitter().Write([]byte(formatRequestLog(c, started, logErr)))

		return nil
	}
}

func handleRequestError(c *fiber.Ctx, err error) error {
	if handlerErr := c.App().ErrorHandler(c, err); handlerErr != nil {
		_ = c.SendStatus(fiber.StatusInternalServerError)
		return handlerErr
	}
	return err
}

func formatRequestLog(c *fiber.Ctx, started time.Time, err error) string {
	return fmt.Sprintf(
		"%s | %d | %s | %s | %s | %s | %s\n",
		started.Format("15:04:05"),
		c.Response().StatusCode(),
		time.Since(started).String(),
		c.IP(),
		c.Method(),
		requestPath(c),
		requestError(err),
	)
}

func requestPath(c *fiber.Ctx) string {
	path := c.Path()
	if strings.TrimSpace(path) == "" {
		path = "-"
	}

	query := string(c.Request().URI().QueryString())
	if query == "" {
		return path
	}
	return path + "?" + query
}

func requestError(err error) string {
	if err == nil {
		return "-"
	}
	return err.Error()
}
