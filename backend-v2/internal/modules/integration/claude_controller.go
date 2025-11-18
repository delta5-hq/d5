package integration

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/services/claude"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

/* ClaudeController handles Claude AI-specific endpoints */
type ClaudeController struct {
	service claude.Service
	db      *qmgo.Database
}

func NewClaudeController(service claude.Service, db *qmgo.Database) *ClaudeController {
	return &ClaudeController{service: service, db: db}
}

/* ClaudeMessagesRequest holds Claude messages API request data */
type ClaudeMessagesRequest struct {
	Messages  []claude.Message `json:"messages"`
	Model     string           `json:"model"`
	MaxTokens int              `json:"max_tokens"`
}

func (r *ClaudeMessagesRequest) Validate() error {
	if len(r.Messages) == 0 {
		return fmt.Errorf("Messages not specified")
	}
	if r.Model == "" {
		return fmt.Errorf("Model name not specified")
	}
	if r.MaxTokens == 0 {
		return fmt.Errorf("max_tokens not specified")
	}
	return nil
}

/* Messages handles Claude messages API */
func (ctrl *ClaudeController) Messages(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req ClaudeMessagesRequest
	if err := parseBody(c, &req); err != nil {
		return err
	}

	if err := req.Validate(); err != nil {
		return response.BadRequest(c, err.Error())
	}

	result, err := ctrl.service.Messages(ctrl.db, userID, req.Messages, req.Model, req.MaxTokens)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(result)
}
