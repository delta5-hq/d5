package workflow

import (
	"github.com/gofiber/fiber/v2"
)

type WorkflowController struct {
	Service *WorkflowService
}

func NewHandler(service *WorkflowService) *WorkflowController {
	return &WorkflowController{Service: service}
}

// GET /workflows/:workflowId
func (h *WorkflowController) GetWorkflow(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")

	wf, err := h.Service.GetByMapID(c.Context(), workflowId)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(wf)
}
