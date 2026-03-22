package integration

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/logger"
	"backend-v2/internal/common/response"
	"backend-v2/internal/models"
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

var log = logger.New("INTEGRATION")

type Controller struct {
	service *Service
	db      *qmgo.Database
}

func NewController(service *Service, db *qmgo.Database) *Controller {
	return &Controller{service: service, db: db}
}

func (ctrl *Controller) Authorization(c *fiber.Ctx) error {
	if c.Locals(constants.ContextUserIDKey) == nil {
		return response.Unauthorized(c, "Authentication needed.")
	}
	return c.Next()
}

func (ctrl *Controller) getUserID(c *fiber.Ctx) string {
	userID, _ := c.Locals(constants.ContextUserIDKey).(string)
	return userID
}

func (ctrl *Controller) findUserIntegration(c *fiber.Ctx, scope ScopeIdentifier) (*models.Integration, error) {
	integration, err := ctrl.service.FindWithFallback(c.Context(), scope)
	if err == qmgo.ErrNoSuchDocuments {
		return nil, response.NotFound(c, "Integration not found")
	}
	if err != nil {
		return nil, response.InternalError(c, err.Error())
	}
	return integration, nil
}

func (ctrl *Controller) GetAll(c *fiber.Ctx) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)

	integration, err := ctrl.service.FindWithFallback(c.Context(), scope)
	if err == qmgo.ErrNoSuchDocuments {
		return c.JSON(fiber.Map{})
	}
	if err != nil {
		log.Error("GetAll: findUserIntegration failed: %v", err)
		return response.InternalError(c, err.Error())
	}

	secureResponse, err := ctrl.service.PrepareSecureIntegrationResponse(integration)
	if err != nil {
		log.Error("GetAll: prepare secure response failed: %v", err)
		return response.InternalError(c, err.Error())
	}

	return c.JSON(secureResponse)
}

func (ctrl *Controller) GetService(c *fiber.Ctx) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)
	service := c.Params("service")

	integration, err := ctrl.findUserIntegration(c, scope)
	if err != nil {
		return err
	}

	decrypted, err := ctrl.service.DecryptIntegration(integration)
	if err != nil {
		log.Error("GetService: decrypt failed: %v", err)
		return response.InternalError(c, err.Error())
	}

	integrationBytes, _ := json.Marshal(decrypted)
	var integrationMap map[string]interface{}
	if err := json.Unmarshal(integrationBytes, &integrationMap); err != nil {
		return response.InternalError(c, "failed to parse integration")
	}

	return c.JSON(map[string]interface{}{
		service: integrationMap[service],
	})
}

func (ctrl *Controller) UpdateService(c *fiber.Ctx) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)
	service := c.Params("service")

	var serviceConfig map[string]interface{}
	if err := c.BodyParser(&serviceConfig); err != nil {
		return response.BadRequest(c, "Something is wrong with the provided data")
	}

	vectors, err := ctrl.service.CreateLLMVector(c.Context(), ctrl.db, scope.UserID, service)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	update := map[string]interface{}{service: serviceConfig}
	if err := ctrl.service.Upsert(c.Context(), scope, update); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{"vectors": vectors})
}

func (ctrl *Controller) Delete(c *fiber.Ctx) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)

	if err := ctrl.service.Delete(c.Context(), scope); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (ctrl *Controller) DeleteService(c *fiber.Ctx) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)
	service := c.Params("service")

	validServices := []string{"openai", "deepseek", "qwen", "claude", "perplexity", "yandex", "custom_llm"}
	isValid := false
	for _, s := range validServices {
		if s == service {
			isValid = true
			break
		}
	}
	if !isValid {
		return response.BadRequest(c, "Invalid service name")
	}

	unset := map[string]interface{}{service: ""}
	update := map[string]interface{}{"$unset": unset}

	if err := ctrl.service.UpdateRaw(c.Context(), scope, update); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.SendStatus(fiber.StatusNoContent)
}

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

func (ctrl *Controller) SetLanguage(c *fiber.Ctx) error {
	return ctrl.updatePreference(c, "lang", "Lang not specified")
}

func (ctrl *Controller) SetModel(c *fiber.Ctx) error {
	return ctrl.updatePreference(c, "model", "Model not specified")
}

func (ctrl *Controller) updatePreference(c *fiber.Ctx, fieldName, errorMsg string) error {
	scope := extractScopeFromRequest(c, ctrl.getUserID)

	var body map[string]interface{}
	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	value, ok := body[fieldName].(string)
	if !ok {
		return response.InternalError(c, errorMsg)
	}

	update := map[string]interface{}{fieldName: value}
	if err := ctrl.service.Upsert(c.Context(), scope, update); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{fieldName: value})
}
