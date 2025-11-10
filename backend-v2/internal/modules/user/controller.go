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
