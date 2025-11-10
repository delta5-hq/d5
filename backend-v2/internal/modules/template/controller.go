package template

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/models"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Controller struct {
	Service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{Service: service}
}

/* GET /templates - List templates visible to user */
func (h *Controller) List(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	templates, err := h.Service.List(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(templates)
}

/* POST /templates - Create or update template */
func (h *Controller) Create(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)
	roles, _ := c.Locals("roles").([]string)

	if userID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authentication needed.",
		})
	}

	/* Parse request body as raw JSON first to extract _id */
	var rawData map[string]interface{}
	if err := json.Unmarshal(c.Body(), &rawData); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
		})
	}

	var templateData models.WorkflowTemplate
	if err := json.Unmarshal(c.Body(), &templateData); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body parse",
		})
	}

	/* Parse _id from raw JSON if present */
	if idStr, ok := rawData["_id"].(string); ok && idStr != "" {
		if objectID, err := primitive.ObjectIDFromHex(idStr); err == nil {
			templateData.TemplateID = objectID
		}
	}

	/* Non-admin cannot create public templates */
	if templateData.Share.Public && !containsRole(roles, constants.Administrator) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Your are not allowed to create a public template.",
		})
	}

	templateData.UserID = userID

	/* Update existing template if _id provided */
	if !templateData.TemplateID.IsZero() {
		templateData.UpdatedAt = time.Now()
		if err := h.Service.Update(c.Context(), templateData.TemplateID.Hex(), &templateData); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"templateId": templateData.TemplateID.Hex(),
		})
	}

	/* Create new template */
	templateData.CreatedAt = time.Now()
	templateData.UpdatedAt = time.Now()
	if err := h.Service.Create(c.Context(), &templateData); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"templateId": templateData.TemplateID.Hex(),
	})
}

/* GET /templates/:templateId */
func (h *Controller) Get(c *fiber.Ctx) error {
	template := c.Locals("template").(*models.WorkflowTemplate)
	return c.JSON(template)
}

/* DELETE /templates/:templateId */
func (h *Controller) Delete(c *fiber.Ctx) error {
	templateID := c.Params("templateId")

	if err := h.Service.Delete(c.Context(), templateID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* PATCH /templates/:templateId - Update background image */
func (h *Controller) UpdateBackgroundImage(c *fiber.Ctx) error {
	templateID := c.Params("templateId")

	var data struct {
		ImageID string `json:"imageId"`
	}

	if err := c.BodyParser(&data); err != nil {
		if jsonErr := json.Unmarshal(c.Body(), &data); jsonErr != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid request body",
			})
		}
	}

	template, err := h.Service.UpdateBackgroundImage(c.Context(), templateID, data.ImageID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"templateId": template.TemplateID.Hex(),
	})
}

func containsRole(roles []string, role constants.Role) bool {
	roleStr := string(role)
	for _, r := range roles {
		if r == roleStr {
			return true
		}
	}
	return false
}
