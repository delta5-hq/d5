package workflow

import (
	"backend-v2/internal/models"

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

	wf, err := h.Service.GetByWorkflowID(c.Context(), workflowId)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(wf)
}

// PUT /workflows/:workflowId
func (h *WorkflowController) UpdateWorkflow(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")

	var update models.Workflow
	if err := c.BodyParser(&update); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	err := h.Service.UpdateWorkflow(c.Context(), workflowId, &update)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "workflow updated successfully",
	})
}
