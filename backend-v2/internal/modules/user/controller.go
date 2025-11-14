package user

import (
	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	Service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{Service: service}
}

/* GET /user - Administrator-only endpoint for RBAC testing */
func (h *Controller) AdminOnly(c *fiber.Ctx) error {
	/* Extract roles from JWT */
	roles, ok := c.Locals("roles").([]string)
	if !ok {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "This endpoint is only available for administrators.",
		})
	}

	/* Check for administrator role */
	isAdmin := false
	for _, role := range roles {
		if role == "administrator" {
			isAdmin = true
			break
		}
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "This endpoint is only available for administrators.",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Administrator access granted",
	})
}

/* GET /users/search - Search users by username */
func (h *Controller) Search(c *fiber.Ctx) error {
	query := c.Query("query")

	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No query given.",
		})
	}

	users, err := h.Service.SearchByName(c.Context(), query, 50)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(users)
}

/* GET /users/search/mail - Search user by email */
func (h *Controller) SearchMail(c *fiber.Ctx) error {
	query := c.Query("query")

	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "No query given.",
		})
	}

	user, err := h.Service.SearchByMail(c.Context(), query)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "No user found.",
		})
	}

	return c.JSON(user)
}

/* GET /users/me - Get current authenticated user */
func (h *Controller) Me(c *fiber.Ctx) error {
	userId, ok := c.Locals("userId").(string)
	if !ok || userId == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authentication required.",
		})
	}

	user, err := h.Service.GetUserByID(c.Context(), userId)
	if err != nil {
		return c.Status(fiber.StatusNotFound).SendString("User not found.")
	}

	return c.JSON(fiber.Map{
		"id":        user.ID,
		"name":      user.Name,
		"mail":      user.Mail,
		"roles":     user.Roles,
		"createdAt": user.CreatedAt,
		"updatedAt": user.UpdatedAt,
	})
}
