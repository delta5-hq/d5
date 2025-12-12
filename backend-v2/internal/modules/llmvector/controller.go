package llmvector

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service *Service
}

func NewController(service *Service) *Controller {
	return &Controller{service: service}
}

/* POST /vector - Save context data */
func (c *Controller) Save(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	var payload struct {
		ContextName *string                          `json:"contextName"`
		Type        string                           `json:"type"`
		Data        map[string][]models.MemoryVector `json:"data"`
		Keep        bool                             `json:"keep"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return response.BadRequest(ctx, "Invalid payload")
	}

	if payload.Type == "" || payload.Data == nil {
		return response.BadRequest(ctx, "Invalid payload: \"type\" and \"data\" are required, and \"data\" should be an object with key-value(source - vectors[]) pairs")
	}

	// Validate data structure
	for source, vectors := range payload.Data {
		if source == "" {
			return response.BadRequest(ctx, "Invalid source key")
		}
		for _, vector := range vectors {
			if vector.Content == "" && len(vector.Embedding) == 0 {
				return response.BadRequest(ctx, "Invalid value for '"+source+"'")
			}
		}
	}

	context, err := c.service.SaveContext(ctx.Context(), payload.ContextName, userID, payload.Type, payload.Data, payload.Keep)
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	return ctx.JSON(context)
}

/* GET /vector - Get context data */
func (c *Controller) Get(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	name := ctx.Query("name")
	contextType := ctx.Query("type")
	source := ctx.Query("source")

	var namePtr *string
	if name != "" {
		namePtr = &name
	}

	context, err := c.service.GetContext(ctx.Context(), namePtr, userID)
	if err != nil {
		return response.NotFound(ctx, "Context not found")
	}

	// Return full store if no type specified
	if contextType == "" {
		return ctx.JSON(context.Store)
	}

	// Return specific type
	typeStore, ok := context.Store[contextType]
	if !ok {
		return response.NotFound(ctx, "Type '"+contextType+"' not found")
	}

	// Return specific source within type
	if source != "" {
		sourceData, ok := typeStore[source]
		if !ok {
			return response.NotFound(ctx, "'"+source+"' not found in type \""+contextType+"'")
		}
		return ctx.JSON(fiber.Map{source: sourceData})
	}

	// Return all sources in type
	return ctx.JSON(typeStore)
}

/* GET /vector/all - Get all contexts for user */
func (c *Controller) GetAll(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	contexts, err := c.service.GetAllContexts(ctx.Context(), userID)
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	if contexts == nil {
		contexts = []models.LLMVector{}
	}

	return ctx.JSON(contexts)
}

/* DELETE /vector - Delete context, type, or sources */
func (c *Controller) Delete(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	var payload struct {
		ContextName *string  `json:"contextName"`
		Type        *string  `json:"type"`
		Sources     []string `json:"sources"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return response.BadRequest(ctx, "Invalid payload")
	}

	err := c.service.DeleteContext(ctx.Context(), payload.ContextName, userID, payload.Type, payload.Sources)
	if err != nil {
		return response.NotFound(ctx, "Context not found")
	}

	// Build response message
	contextNameStr := ""
	if payload.ContextName != nil {
		contextNameStr = *payload.ContextName
	}

	if payload.Type != nil && payload.Sources != nil && len(payload.Sources) > 0 {
		return ctx.JSON(fiber.Map{
			"message": "Keys removed from type \"" + *payload.Type + "\" in context \"" + contextNameStr + "\"",
		})
	}

	if payload.Type != nil {
		return ctx.JSON(fiber.Map{
			"message": "All data cleared from type '" + *payload.Type + "' in context '" + contextNameStr + "'",
		})
	}

	return ctx.JSON(fiber.Map{
		"message": "Context '" + contextNameStr + "' removed successfully",
	})
}

/* GET /vector/overview - Get metadata overview */
func (c *Controller) Overview(ctx *fiber.Ctx) error {
	userID, ok := ctx.Locals("userId").(string)
	if !ok {
		return response.Unauthorized(ctx, "Unauthorized")
	}

	filterType := ctx.Query("type")
	var filterTypePtr *string
	if filterType != "" {
		filterTypePtr = &filterType
	}

	overview, err := c.service.GetOverview(ctx.Context(), userID, filterTypePtr)
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	return ctx.JSON(overview)
}
