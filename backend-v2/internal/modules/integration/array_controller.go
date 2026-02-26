package integration

import (
	"backend-v2/internal/common/response"
	"net/url"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func (ctrl *Controller) AddArrayItem(c *fiber.Ctx) error {
	userID := ctrl.getUserID(c)
	fieldName := c.Params("field")

	if !IsArrayFieldRegistered(fieldName) {
		return response.BadRequest(c, "Invalid array field name")
	}

	var item map[string]interface{}
	if err := c.BodyParser(&item); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if err := ctrl.service.AddArrayItem(c.Context(), userID, fieldName, item); err != nil {
		if strings.Contains(err.Error(), "already exists in field") ||
			strings.Contains(err.Error(), "alias is required") {
			return response.BadRequest(c, err.Error())
		}
		return response.InternalError(c, err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(item)
}

func (ctrl *Controller) UpdateArrayItem(c *fiber.Ctx) error {
	userID := ctrl.getUserID(c)
	fieldName := c.Params("field")
	rawAlias := c.Params("alias")
	alias, err := url.PathUnescape(rawAlias)
	if err != nil {
		alias = rawAlias
	}

	if !IsArrayFieldRegistered(fieldName) {
		return response.BadRequest(c, "Invalid array field name")
	}

	var updates map[string]interface{}
	if err := c.BodyParser(&updates); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	if err := ctrl.service.UpdateArrayItem(c.Context(), userID, fieldName, alias, updates); err != nil {
		if strings.Contains(err.Error(), "not found in field") {
			return response.NotFound(c, err.Error())
		}
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{"alias": alias})
}

func (ctrl *Controller) DeleteArrayItem(c *fiber.Ctx) error {
	userID := ctrl.getUserID(c)
	fieldName := c.Params("field")
	rawAlias := c.Params("alias")
	alias, err := url.PathUnescape(rawAlias)
	if err != nil {
		alias = rawAlias
	}

	if !IsArrayFieldRegistered(fieldName) {
		return response.BadRequest(c, "Invalid array field name")
	}

	if err := ctrl.service.DeleteArrayItem(c.Context(), userID, fieldName, alias); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.SendStatus(fiber.StatusNoContent)
}
