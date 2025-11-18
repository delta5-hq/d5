package workflow

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/response"
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func Authorization(c *fiber.Ctx) error {
	method := c.Method()
	workflow := c.Locals("workflow").(*models.Workflow)

	userID := c.Locals(constants.ContextUserIDKey)

	if method == "GET" && workflow.IsPublic() && userID == nil {
		c.Locals("access", WorkflowAccess{
			IsOwner:     false,
			IsWriteable: false,
			IsReadable:  true,
		})
		return c.Next()
	}

	if userID == nil {
		return response.Unauthorized(c, "Authentication required")
	}

	userIDStr := userID.(string)

	/* Check for administrator role - administrators bypass all access controls */
	if roles := c.Locals("roles"); roles != nil {
		if rolesSlice, ok := roles.([]string); ok {
			for _, role := range rolesSlice {
				if role == string(constants.Administrator) {
					c.Locals("access", WorkflowAccess{
						IsOwner:     true,
						IsWriteable: true,
						IsReadable:  true,
					})
					return c.Next()
				}
			}
		}
	}

	/* Extract mail claim from JWT if present */
	var userMail string
	if auth := c.Locals("auth"); auth != nil {
		if claims, ok := auth.(jwt.MapClaims); ok {
			if mail, exists := claims["mail"]; exists {
				if mailStr, ok := mail.(string); ok {
					userMail = mailStr
				}
			}
		}
	}

	var roleBinding *models.RoleBinding

	accessList := workflow.Share.Access
	for i := range workflow.Share.Access {
		a := &accessList[i]

		/* Match by user ID */
		if a.SubjectType == "user" && a.SubjectID == userIDStr {
			roleBinding = a
			break
		}

		/* Match by mail claim in JWT */
		if a.SubjectType == "mail" && userMail != "" && a.SubjectID == userMail {
			roleBinding = a
			break
		}
	}

	isOwner := workflow.UserID == userIDStr || (roleBinding != nil && roleBinding.Role == constants.Owner)
	isWriteable := isOwner || (roleBinding != nil && roleBinding.Role == constants.Contributor) || workflow.IsPublicWriteable()
	isReadable := isWriteable || (roleBinding != nil && roleBinding.Role == constants.Reader) || workflow.IsPublic()

	/* Cross-user workflow leakage prevention: Return 401 instead of 403 when user has no relationship to workflow */
	if (method == "GET" || method == "DELETE") && !isReadable {
		/* If user is not owner and not in access list and workflow not public, return 401 to hide existence */
		if workflow.UserID != userIDStr && roleBinding == nil && !workflow.IsPublic() {
			return response.Unauthorized(c, "Authentication needed.")
		}
		/* Otherwise return 403 (user has some relationship but insufficient permissions) */
		return response.Forbidden(c, "Access denied.")
	}

	c.Locals("access", WorkflowAccess{
		IsOwner:     isOwner,
		IsWriteable: isWriteable,
		IsReadable:  isReadable,
	})

	return c.Next()
}

func Load(db *qmgo.Database) fiber.Handler {
	return func(c *fiber.Ctx) error {
		workflowId := c.Params("workflowId")
		collection := db.Collection("workflows")

		var wf models.Workflow
		err := collection.Find(c.Context(), map[string]string{"workflowId": workflowId}).One(&wf)
		if err != nil {
			return response.NotFound(c, "Workflow not found")
		}

		c.Locals("workflow", &wf)

		return c.Next()
	}
}

func LoadTemplate(db *qmgo.Database) fiber.Handler {
	return func(c *fiber.Ctx) error {
		templateId := c.Params("templateId")
		collection := db.Collection("templates")

		objID, err := primitive.ObjectIDFromHex(templateId)
		if err != nil {
			return response.BadRequest(c, "Invalid template ID")
		}

		var template models.WorkflowTemplate
		findErr := collection.Find(c.Context(), qmgo.M{"_id": objID}).One(&template)
		if findErr != nil {
			return response.NotFound(c, "Template not found")
		}

		c.Locals("template", &template)

		return c.Next()
	}
}

func AuthTemplate(c *fiber.Ctx) error {
	method := c.Method()

	template := c.Locals("template").(*models.WorkflowTemplate)
	userID := c.Locals(constants.ContextUserIDKey)

	if method == "GET" && template.UserID != userID && !template.IsPublic() {
		return response.Forbidden(c, "Access denied.")
	}

	return c.Next()
}
