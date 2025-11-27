package workflow

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/dto"
	"backend-v2/internal/common/response"
	"backend-v2/internal/common/utils"
	"backend-v2/internal/models"

	"encoding/json"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/mongo"
)

type WorkflowController struct {
	Service     *WorkflowService
	db          *qmgo.Database
	mongoClient *mongo.Client
}

func NewHandler(service *WorkflowService, db *qmgo.Database, mongoClient *mongo.Client) *WorkflowController {
	return &WorkflowController{
		Service:     service,
		db:          db,
		mongoClient: mongoClient,
	}
}

// GET /workflows/:workflowId
func (h *WorkflowController) GetWorkflow(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	return c.JSON(workflow)
}

// PUT /workflows/:workflowId
func (h *WorkflowController) UpdateWorkflow(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")

	var update models.Workflow
	if err := c.BodyParser(&update); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	err := h.Service.UpdateWorkflow(c.Context(), workflowId, &update)
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "workflow updated successfully",
	})
}

// GET /workflows
func (h *WorkflowController) GetWorkflows(c *fiber.Ctx) error {
	/* Reject malformed JWT tokens if auth was attempted */
	/* Check if Authorization header or auth cookie was provided */
	hasAuthHeader := c.Get("Authorization") != ""
	hasAuthCookie := c.Cookies("auth") != ""
	
	if (hasAuthHeader || hasAuthCookie) && c.Locals("jwtOriginalError") != nil {
		return response.Unauthorized(c, "Authentication failed")
	}

	userID, _ := c.Locals(constants.ContextUserIDKey).(string)

	var search *string
	if s := c.Query(constants.QuerySearchKey); s != "" {
		search = &s
	}

	var page *int
	if s := c.Query(constants.QueryPageKey); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			page = &v
		}
	}

	var limit *int
	if s := c.Query(constants.QueryLimitKey); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			limit = &v
		}
	}

	shareFilterStr := c.Query(QueryFilterKey)
	shareFilter := ConvertShare(shareFilterStr)

	publicString := c.Query(QueryWorkflowsPublicKey)
	isPublic := publicString == "true"
	
	/* If no authentication and no explicit public param, default to public workflows */
	if userID == "" && publicString == "" {
		isPublic = true
	}

	query := GetWorkflowsQuery{
		PaginationDto: dto.PaginationDto{
			Search: search,
			Page:   page,
			Limit:  limit,
		},
		UserID:      userID,
		IsPublic:    isPublic,
		ShareFilter: shareFilter,
	}

	workflows, count, err := h.Service.GetWorkflows(c.Context(), query)
	if err != nil {
		return response.InternalError(c, err.Error())
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"data":  workflows,
		"total": count,
		"page":  page,
		"limit": limit,
	})
}

// POST /workflows
func (h *WorkflowController) CreateWorkflow(c *fiber.Ctx) error {
	userID := c.Locals(constants.ContextUserIDKey)
	
	if userID == nil {
		return response.Unauthorized(c, "Authentication required")
	}

	userIDStr := userID.(string)
	auth, err := utils.GetJwtPayload(c)

	if err != nil {
		return response.InternalError(c, err.Error())
	}

	/* Parse request body for optional fields like share */
	var requestBody map[string]interface{}
	var share *models.Share
	
	if err := c.BodyParser(&requestBody); err == nil {
		if shareData, exists := requestBody["share"]; exists {
			/* Convert map to Share struct */
			shareBytes, _ := json.Marshal(shareData)
			var parsedShare models.Share
			if json.Unmarshal(shareBytes, &parsedShare) == nil {
				share = &parsedShare
			}
		}
	}

	workflow, createErr := h.Service.CreateWorkflow(c.Context(), CreateWorkflowDto{
		UserID: userIDStr,
		Auth:   auth,
		Share:  share,
	})

	if createErr != nil {
		return c.Status(createErr.Status).JSON(fiber.Map{
			"error": createErr.Message,
		})
	}

	return c.Status(fiber.StatusOK).JSON(workflow)
}

// DELETE /workflows/:workflowId
func (h *WorkflowController) DeleteWorkflow(c *fiber.Ctx) error {
	workflowId := c.Params("workflowId")
	access := c.Locals("access").(WorkflowAccess)

	err := h.Service.DeleteWorkflow(c.Context(), workflowId, access)
	if err != nil {
		return c.Status(err.Status).JSON(fiber.Map{
			"error": err.Message,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

// GET /workflows/:workflowId/share
func (h *WorkflowController) GetShare(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	return c.Status(fiber.StatusOK).JSON(workflow.Share)
}

// GET /workflows/:workflowId/share/access
func (h *WorkflowController) GetShareAccess(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	return c.Status(fiber.StatusOK).JSON(workflow.Share.Access)
}

// POST /workflows/:workflowId/share/access
func (h *WorkflowController) SetShareAccess(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)
	access := c.Locals("access").(WorkflowAccess)

	var update []*models.RoleBinding
	if err := c.BodyParser(&update); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	err := h.Service.SetShareAccess(c.Context(), workflow, access, update)
	if err != nil {
		return c.Status(err.Status).JSON(fiber.Map{
			"error": err.Message,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

// GET /workflows/:workflowId/share/public
func (h *WorkflowController) GetSharePublic(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	return c.Status(fiber.StatusOK).JSON(workflow.Share.Public)
}

// POST /workflows/:workflowId/share/public
func (h *WorkflowController) SetSharePublic(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)
	access := c.Locals("access").(WorkflowAccess)

	/* Extract user roles from JWT claims */
	var userRoles []string
	if auth := c.Locals("auth"); auth != nil {
		if claims, ok := auth.(jwt.MapClaims); ok {
			if rolesRaw, exists := claims["roles"]; exists {
				if roles, ok := rolesRaw.([]interface{}); ok {
					for _, r := range roles {
						if roleStr, ok := r.(string); ok {
							userRoles = append(userRoles, roleStr)
						}
					}
				}
			}
		}
	}

	var update map[string]interface{}
	if err := c.BodyParser(&update); err != nil {
		if jsonErr := json.Unmarshal(c.Body(), &update); jsonErr != nil {
			return response.BadRequest(c, "invalid request body")
		}
	}

	enabled, hasEnabled := update["enabled"].(bool)
	if !hasEnabled {
		return response.BadRequest(c, "Badly formatted request.")
	}

	publicState := workflow.Share.Public
	publicState.Enabled = enabled
	
	if hidden, ok := update["hidden"].(bool); ok {
		publicState.Hidden = hidden
	}
	if writeable, ok := update["writeable"].(bool); ok {
		publicState.Writeable = writeable
	}

	err := h.Service.SetSharePublic(c.Context(), workflow, access, &publicState, userRoles)
	if err != nil {
		return c.Status(err.Status).JSON(fiber.Map{
			"error": err.Message,
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

// POST /workflows/from/template/:templateId
func (h *WorkflowController) CreateWorkflowFromTemplate(c *fiber.Ctx) error {
	template := c.Locals("template").(*models.WorkflowTemplate)
	userID := c.Locals(constants.ContextUserIDKey).(string)

	workflow, createErr := h.Service.CreateWorkflowFromTemplate(c.Context(), template, userID)

	if createErr != nil {
		c.Status(createErr.Status).JSON(fiber.Map{
			"error": createErr.Message,
		})
	}

	return c.Status(fiber.StatusCreated).JSON(workflow)
}
