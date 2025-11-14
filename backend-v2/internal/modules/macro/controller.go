package macro

import (
	"backend-v2/internal/models"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{
		service: service,
	}
}

func (h *Controller) Create(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	var macro models.Macro
	if err := c.BodyParser(&macro); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	existingMacro, err := h.service.FindByName(c.Context(), macro.Name)
	if err == nil && existingMacro != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Macro already exists",
		})
	}

	macro.UserID = userID

	macroID, err := h.service.Create(c.Context(), &macro)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"macroId": macroID,
	})
}

func (h *Controller) List(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	macros, err := h.service.FindByUserID(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(macros)
}

func (ctrl *Controller) Get(c *fiber.Ctx) error {
	macro := c.Locals("macro").(*models.Macro)
	return c.JSON(macro)
}

func (ctrl *Controller) GetByName(c *fiber.Ctx) error {
	name := c.Params("name")

	macro, err := ctrl.service.FindByName(c.Context(), name)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return c.SendStatus(fiber.StatusNoContent)
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(macro)
}

func (ctrl *Controller) Delete(c *fiber.Ctx) error {
	macroID := c.Params("macroId")

	err := ctrl.service.Delete(c.Context(), macroID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": fmt.Sprintf("Cannot delete macro: %v", err),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
}
