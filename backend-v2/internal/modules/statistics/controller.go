package statistics

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

type Controller struct {
	db *qmgo.Database
}

func NewController(db *qmgo.Database) *Controller {
	return &Controller{db: db}
}

/* Authorization - admin only */
func (ctrl *Controller) Authorization(c *fiber.Ctx) error {
	roles, ok := c.Locals("roles").([]string)
	if !ok {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "This endpoint is only available for administrators.",
		})
	}

	isAdmin := false
	for _, role := range roles {
		if role == "administrator" {
			isAdmin = true
			break
		}
	}

	if !isAdmin {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message": "This endpoint is only available for administrators.",
		})
	}

	return c.Next()
}

/* GET /statistics/workflow - workflow statistics */
func (ctrl *Controller) WorkflowServe(c *fiber.Ctx) error {
	workflows := ctrl.db.Collection("workflows")
	
	cursor := workflows.Find(c.Context(), qmgo.M{}).Cursor()
	defer cursor.Close()

	lines := [][]interface{}{
		{"workflowId", "userId", "title", "nodeCount", "edgeCount", "shareCount"},
	}

	for cursor.Next(c.Context()) {
		var doc map[string]interface{}
		if err := cursor.All(&doc); err != nil {
			continue
		}

		nodeCount := 0
		edgeCount := 0
		shareCount := 0

		if nodes, ok := doc["nodes"].(map[string]interface{}); ok {
			nodeCount = len(nodes)
		}
		if edges, ok := doc["edges"].(map[string]interface{}); ok {
			edgeCount = len(edges)
		}
		if share, ok := doc["share"].(map[string]interface{}); ok {
			if access, ok := share["access"].([]interface{}); ok {
				shareCount = len(access)
			}
		}

		lines = append(lines, []interface{}{
			doc["workflowId"],
			doc["userId"],
			doc["title"],
			nodeCount,
			edgeCount,
			shareCount,
		})
	}

	return c.JSON(lines)
}

/* GET /statistics/workflow/download - CSV export (stub) */
func (ctrl *Controller) WorkflowCsv(c *fiber.Ctx) error {
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		"message": "Requires ctx.state.lines from workflowServe middleware",
	})
}

/* GET /statistics/users - user list with pagination */
func (ctrl *Controller) UserList(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 10)
	if limit < 1 {
		limit = 10
	}
	skip := (page - 1) * limit

	users := ctrl.db.Collection("users")
	
	total, err := users.Find(c.Context(), qmgo.M{}).Count()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	var userList []map[string]interface{}
	err = users.Find(c.Context(), qmgo.M{}).Sort("-createdAt").Skip(int64(skip)).Limit(int64(limit)).All(&userList)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"total": total,
		"page":  page,
		"limit": limit,
		"data":  userList,
	})
}

/* GET /statistics/users/activity - user activity stats */
func (ctrl *Controller) UserActivity(c *fiber.Ctx) error {
	/* Stub - returns empty array */
	return c.JSON([]interface{}{})
}

/* GET /statistics/workflow/:userId - per-user workflow stats */
func (ctrl *Controller) UserWorkflowStatistics(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* GET /statistics/users/:userId - user details */
func (ctrl *Controller) UserStatistics(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* POST /statistics/users/:userId/comment - add user comment */
func (ctrl *Controller) UserComment(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* GET /statistics/waitlist - Returns pending users */
func (ctrl *Controller) UserWaitlist(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"total": 0,
		"page":  1,
		"limit": 10,
		"data":  []interface{}{},
	})
}

/* GET /statistics/waitlist/confirm/:waitUserId - approve waitlist user */
func (ctrl *Controller) ApproveWaitlistUser(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* GET /statistics/waitlist/reject/:waitUserId - reject waitlist user */
func (ctrl *Controller) RejectWaitlistUser(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* POST /statistics/waitlist/confirm/all - batch approve */
func (ctrl *Controller) ActivateUsersBatch(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}

/* POST /statistics/waitlist/reject/all - batch reject */
func (ctrl *Controller) RejectUsersBatch(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"success": true,
	})
}
