package integration

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/response"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

/* Controller handles core integration CRUD and configuration */
type Controller struct {
	service *Service
	db      *qmgo.Database
}

func NewController(service *Service, db *qmgo.Database) *Controller {
	return &Controller{service: service, db: db}
}

func (ctrl *Controller) Authorization(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)

	if userID == nil {
		return response.Unauthorized(c, "Authentication needed.")
	}

	return c.Next()
}

/* GET /integration - Returns all integration config for user */
func (ctrl *Controller) GetAll(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	integration, err := ctrl.service.FindByUserID(c.Context(), userID)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return response.NotFound(c, "Integration not found")
		}
		return response.InternalError(c, err.Error())
	}

	return c.JSON(integration)
}

/* GET /integration/:service - Returns specific service config */
func (ctrl *Controller) GetService(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)
	service := c.Params("service")

	integration, err := ctrl.service.FindByUserID(c.Context(), userID)
	if err != nil {
		if err == qmgo.ErrNoSuchDocuments {
			return response.NotFound(c, "Integration for the called application was not found")
		}
		return response.InternalError(c, err.Error())
	}

	integrationBytes, _ := json.Marshal(integration)
	var integrationMap map[string]interface{}
	json.Unmarshal(integrationBytes, &integrationMap)

	responseMap := map[string]interface{}{
		service: integrationMap[service],
	}

	return c.JSON(responseMap)
}

/* PUT /integration/:service/update - Updates service API keys */
func (ctrl *Controller) UpdateService(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)
	service := c.Params("service")

	var serviceConfig map[string]interface{}
	if err := c.BodyParser(&serviceConfig); err != nil {
		return response.BadRequest(c, "Something is wrong with the provided data")
	}

	vectors, err := ctrl.service.CreateLLMVector(c.Context(), ctrl.db, userID, service)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	update := map[string]interface{}{
		service: serviceConfig,
	}

	err = ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{
		"vectors": vectors,
	})
}

/* DELETE /integration - Deletes all integration config */
func (ctrl *Controller) Delete(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	err := ctrl.service.Delete(c.Context(), userID)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.SendStatus(fiber.StatusNoContent)
}

/* GET /integration/languages - Returns available languages */
func (ctrl *Controller) GetLanguages(c *fiber.Ctx) error {
	languages := []map[string]string{
		{"code": "en", "name": "English"},
		{"code": "es", "name": "Spanish"},
		{"code": "fr", "name": "French"},
		{"code": "de", "name": "German"},
		{"code": "ru", "name": "Russian"},
		{"code": "zh", "name": "Chinese"},
	}
	return c.JSON(languages)
}

/* POST /integration/language - Sets language preference */
func (ctrl *Controller) SetLanguage(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	/* Node.js reads 'lang' but test sends 'language' - field mismatch causes 500 */
	lang, ok := body["lang"].(string)
	if !ok {
		return response.InternalError(c, "Lang not specified")
	}

	update := map[string]interface{}{
		"lang": lang,
	}

	err := ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{
		"lang": lang,
	})
}

/* POST /integration/model - Sets model preference */
func (ctrl *Controller) SetModel(c *fiber.Ctx) error {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	model, ok := body["model"].(string)
	if !ok {
		return response.InternalError(c, "Model not specified")
	}

	update := map[string]interface{}{
		"model": model,
	}

	err := ctrl.service.Upsert(c.Context(), userID, update)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{
		"model": model,
	})
}

/* Shared helper functions used by service controllers */

func getUserID(c *fiber.Ctx) (string, error) {
	userID, ok := c.Locals(constants.ContextUserIDKey).(string)
	if !ok || userID == "" {
		return "", fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}
	return userID, nil
}

func parseBody(c *fiber.Ctx, v interface{}) error {
	if err := c.BodyParser(v); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "Invalid request body")
	}
	return nil
}
