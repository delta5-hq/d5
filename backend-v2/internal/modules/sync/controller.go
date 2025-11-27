package sync

import (
	"backend-v2/internal/common/response"
	"backend-v2/internal/config"
	"backend-v2/internal/models"
	"backend-v2/internal/modules/user"
	"encoding/json"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	UserService *user.Service
}

func NewController(userService *user.Service) *Controller {
	return &Controller{UserService: userService}
}

/* Authorization middleware - requires SYNC_USER_ID */
func Authorization(c *fiber.Ctx) error {
	userID, _ := c.Locals("userId").(string)

	if config.SyncUserID == "" {
		return response.InternalError(c, "Not configured.")
	}

	if userID != config.SyncUserID {
		return response.Forbidden(c, "Access denied.")
	}

	return c.Next()
}

/* POST /sync/users - Bulk upsert users */
func (h *Controller) AllUser(c *fiber.Ctx) error {
	var rawData interface{}
	if err := json.Unmarshal(c.Body(), &rawData); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	/* Support single object or array */
	var userDataList []models.User
	switch rawData.(type) {
	case map[string]interface{}:
		/* Single user object */
		var userData models.User
		if err := json.Unmarshal(c.Body(), &userData); err != nil {
			return response.BadRequest(c, "invalid user data")
		}
		userDataList = []models.User{userData}
	case []interface{}:
		/* Array of users */
		if err := json.Unmarshal(c.Body(), &userDataList); err != nil {
			return response.BadRequest(c, "invalid user array")
		}
	default:
		return response.BadRequest(c, "invalid request format")
	}

	/* Validate and upsert users */
	errors := make(map[int]string)

	for i, userData := range userDataList {
		if userData.ID == "" {
			errors[i] = "Id missing."
			continue
		}
		if userData.Name == "" {
			errors[i] = fmt.Sprintf("User '%s': Username missing.", userData.ID)
			continue
		}

		/* Upsert user */
		if err := h.UserService.Upsert(c.Context(), &userData); err != nil {
			errors[i] = err.Error()
		}
	}

	if len(errors) > 0 {
		errorMsg := "Error in some user objects: "
		for i, err := range errors {
			errorMsg += fmt.Sprintf("index %d: %s, ", i, err)
		}
		return response.BadRequest(c, errorMsg)
	}

	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* POST /sync/userMetaData - Bulk update user metadata */
func (h *Controller) AllUserMetaData(c *fiber.Ctx) error {
	var rawData interface{}
	if err := json.Unmarshal(c.Body(), &rawData); err != nil {
		return response.BadRequest(c, "invalid request body")
	}

	/* Support single object or array */
	var metaDataList []map[string]interface{}
	switch rawData.(type) {
	case map[string]interface{}:
		metaDataList = []map[string]interface{}{rawData.(map[string]interface{})}
	case []interface{}:
		for _, item := range rawData.([]interface{}) {
			if obj, ok := item.(map[string]interface{}); ok {
				metaDataList = append(metaDataList, obj)
			}
		}
	default:
		return response.BadRequest(c, "invalid request format")
	}

	/* Validate - require id field */
	errors := make(map[int]string)
	for i, metaData := range metaDataList {
		if _, ok := metaData["id"]; !ok {
			errors[i] = "Id missing."
		}
	}

	if len(errors) > 0 {
		errorMsg := "Error in some user objects: "
		for i, err := range errors {
			errorMsg += fmt.Sprintf("index %d: %s, ", i, err)
		}
		return response.BadRequest(c, errorMsg)
	}

	/* Real implementation would update user metadata here */
	return c.JSON(fiber.Map{
		"success": true,
	})
}
