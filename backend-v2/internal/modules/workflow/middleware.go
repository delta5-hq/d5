package workflow

import (
	"backend-v2/internal/common/constants"
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
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
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authentication required",
		})
	}

	var roleBinding *models.RoleBinding

	accessList := workflow.Share.Access
	for i := range workflow.Share.Access {
		a := &accessList[i]

		if (a.SubjectType == "user" && a.SubjectID == string(constants.User)) ||
			(a.SubjectType == "mail" && a.SubjectID == string(constants.Mail)) {
			roleBinding = a
			break
		}
	}

	isOwner := workflow.UserID == userID || (roleBinding != nil && roleBinding.Role == constants.Owner)
	isWriteable := isOwner || (roleBinding != nil && roleBinding.Role == constants.Contributor) || workflow.IsPublicWriteable()
	isReadable := isWriteable || (roleBinding != nil && roleBinding.Role == constants.Reader) || workflow.IsPublic()

	if method == "GET" && !isReadable {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied.",
		})
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
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Workflow not found",
			})
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
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid template ID",
			})
		}

		var template models.WorkflowTemplate
		findErr := collection.Find(c.Context(), qmgo.M{"_id": objID}).One(&template)
		if findErr != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Template not found",
			})
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
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access denied.",
		})
	}

	return c.Next()
}
