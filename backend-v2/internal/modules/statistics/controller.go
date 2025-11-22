package statistics

import (
	"backend-v2/internal/common/response"
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
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
		return response.Forbidden(c, "This endpoint is only available for administrators.")
	}

	isAdmin := false
	for _, role := range roles {
		if role == "administrator" {
			isAdmin = true
			break
		}
	}

	if !isAdmin {
		return response.Forbidden(c, "This endpoint is only available for administrators.")
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
	return response.InternalError(c, "Requires ctx.state.lines from workflowServe middleware")
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
		return response.InternalError(c, err.Error())
	}

	var userList []map[string]interface{}
	err = users.Find(c.Context(), qmgo.M{}).Sort("-createdAt").Skip(int64(skip)).Limit(int64(limit)).All(&userList)
	if err != nil {
		return response.InternalError(c, err.Error())
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
	userId := c.Params("userId")
	if userId == "" {
		return response.BadRequest(c, "User ID required")
	}

	/* userId is a string field, not ObjectID */
	pipeline := bson.A{
		bson.D{{"$match", bson.D{
			{"$or", bson.A{
				bson.D{{"userId", userId}},
				bson.D{{"share.access.subjectId", userId}},
			}},
		}}},
		bson.D{{"$project", bson.D{
			{"userId", 1},
			{"workflowId", "$_id"},
			{"createdAt", 1},
			{"updatedAt", 1},
			{"nodeCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{bson.D{{"$objectToArray", "$nodes"}}, bson.A{}}}}}}},
			{"edgeCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{bson.D{{"$objectToArray", "$edges"}}, bson.A{}}}}}}},
			{"title", 1},
			{"role", bson.D{
				{"$ifNull", bson.A{
					bson.D{{"$reduce", bson.D{
						{"input", bson.D{{"$filter", bson.D{
							{"input", "$share.access"},
							{"as", "shared"},
							{"cond", bson.D{{"$eq", bson.A{"$$shared.subjectId", userId}}}},
						}}}},
						{"initialValue", nil},
						{"in", "$$this.role"},
					}}},
					"owner",
				}},
			}},
			{"sharedWithCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{"$share.access", bson.A{}}}}}}},
			{"public", bson.D{{"$ifNull", bson.A{"$share.public.enabled", false}}}},
			{"hidden", bson.D{{"$ifNull", bson.A{"$share.public.hidden", true}}}},
		}}},
		bson.D{{"$project", bson.D{
			{"userId", 1},
			{"workflowId", 1},
			{"createdAt", 1},
			{"updatedAt", 1},
			{"nodeCount", 1},
			{"edgeCount", 1},
			{"title", bson.D{{"$cond", bson.D{
				{"if", bson.D{{"$eq", bson.A{"$public", true}}}},
				{"then", "$title"},
				{"else", nil},
			}}}},
			{"sharedWithCount", 1},
			{"public", 1},
			{"hidden", 1},
			{"role", 1},
		}}},
		bson.D{{"$sort", bson.D{{"updatedAt", -1}}}},
	}

	cursor := ctrl.db.Collection("workflows").Aggregate(c.Context(), pipeline)

	results := []bson.M{}  // Initialize to empty slice, not nil
	if err := cursor.All(&results); err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(results)
}

/* GET /statistics/users/:userId - user details */
func (ctrl *Controller) UserStatistics(c *fiber.Ctx) error {
	userId := c.Params("userId")
	if userId == "" {
		return response.BadRequest(c, "User ID required")
	}

	/* userId is a string field (id), not ObjectID */
	// Get user from database
	var user bson.M
	userColl := ctrl.db.Collection("users")
	if err := userColl.Find(c.Context(), bson.M{"id": userId}).One(&user); err != nil {
		return response.NotFound(c, "User not found")
	}

	// Get workflow statistics
	pipeline := bson.A{
		bson.D{{"$match", bson.D{
			{"$or", bson.A{
				bson.D{{"userId", userId}},
				bson.D{{"share.access.subjectId", userId}},
			}},
		}}},
		bson.D{{"$project", bson.D{
			{"userId", 1},
			{"workflowId", 1},
			{"createdAt", 1},
			{"updatedAt", 1},
			{"nodeCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{bson.D{{"$objectToArray", "$nodes"}}, bson.A{}}}}}}},
			{"edgeCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{bson.D{{"$objectToArray", "$edges"}}, bson.A{}}}}}}},
			{"sharedWith", bson.D{{"$ifNull", bson.A{"$share.access.subjectId", bson.A{}}}}},
			{"title", 1},
			{"biggestWorkflowCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{bson.D{{"$objectToArray", "$nodes"}}, bson.A{}}}}}}},
			{"sharedWithCount", bson.D{{"$size", bson.D{{"$ifNull", bson.A{"$share.access", bson.A{}}}}}}},
		}}},
		bson.D{{"$facet", bson.D{
			{"categorizedBySharedWorkflow", bson.A{
				bson.D{{"$unwind", "$sharedWith"}},
				bson.D{{"$group", bson.D{
					{"_id", "$sharedWith"},
					{"shareCount", bson.D{{"$sum", 1}}},
				}}},
			}},
			{"categorizedByOwnWorkflow", bson.A{
				bson.D{{"$group", bson.D{
					{"_id", "$userId"},
					{"workflowId", bson.D{{"$addToSet", "$workflowId"}}},
					{"workflowCount", bson.D{{"$sum", 1}}},
					{"nodeCount", bson.D{{"$sum", "$nodeCount"}}},
					{"edgeCount", bson.D{{"$sum", "$edgeCount"}}},
					{"biggestWorkflowCount", bson.D{{"$max", "$biggestWorkflowCount"}}},
					{"sharedWithCount", bson.D{{"$sum", "$sharedWithCount"}}},
					{"lastWorkflowChange", bson.D{{"$max", "$updatedAt"}}},
				}}},
			}},
		}}},
		bson.D{{"$project", bson.D{
			{"result", bson.D{{"$concatArrays", bson.A{"$categorizedBySharedWorkflow", "$categorizedByOwnWorkflow"}}}},
		}}},
		bson.D{{"$unwind", bson.D{{"path", "$result"}}}},
		bson.D{{"$replaceRoot", bson.D{{"newRoot", "$result"}}}},
		bson.D{{"$group", bson.D{
			{"_id", "$_id"},
			{"workflowCount", bson.D{{"$sum", "$workflowCount"}}},
			{"shareCount", bson.D{{"$sum", "$shareCount"}}},
			{"nodeCount", bson.D{{"$sum", "$nodeCount"}}},
			{"edgeCount", bson.D{{"$sum", "$edgeCount"}}},
			{"workflowIds", bson.D{{"$addToSet", "$workflowId"}}},
			{"sharedWithCount", bson.D{{"$sum", "$sharedWithCount"}}},
			{"biggestWorkflowCount", bson.D{{"$max", "$biggestWorkflowCount"}}},
			{"lastWorkflowChange", bson.D{{"$max", "$lastWorkflowChange"}}},
		}}},
		bson.D{{"$match", bson.D{{"_id", userId}}}},
	}

	cursor := ctrl.db.Collection("workflows").Aggregate(c.Context(), pipeline)

	var statistics []bson.M
	if err := cursor.All(&statistics); err != nil {
		return response.InternalError(c, err.Error())
	}

	var stats bson.M
	if len(statistics) > 0 {
		stats = statistics[0]
	} else {
		stats = bson.M{}
	}

	// Build response
	response := bson.M{
		"id":                   user["_id"],
		"name":                 user["name"],
		"mail":                 user["mail"],
		"roles":                user["roles"],
		"comment":              user["comment"],
		"createdAt":            user["createdAt"],
		"updatedAt":            user["updatedAt"],
		"lastWorkflowChange":   stats["lastWorkflowChange"],
		"limitWorkflows":       user["limitWorkflows"],
		"limitNodes":           user["limitNodes"],
		"biggestWorkflowCount": stats["biggestWorkflowCount"],
		"workflowCount":        stats["workflowCount"],
		"shareCount":           stats["shareCount"],
		"sharedWithCount":      stats["sharedWithCount"],
		"workflowIds":          stats["workflowIds"],
		"nodeCount":            stats["nodeCount"],
		"edgeCount":            stats["edgeCount"],
		"meta":                 user["meta"],
	}

	return c.JSON(response)
}

/* POST /statistics/users/:userId/comment - add user comment */
func (ctrl *Controller) UserComment(c *fiber.Ctx) error {
	userId := c.Params("userId")
	if userId == "" {
		return response.BadRequest(c, "User ID required")
	}

	/* userId is a string field (id), not ObjectID */
	var payload struct {
		Data string `json:"data"`
	}
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return response.BadRequest(c, "Invalid JSON")
	}

	userColl := ctrl.db.Collection("users")
	err := userColl.UpdateOne(c.Context(), bson.M{"id": userId}, bson.M{"$set": bson.M{"comment": payload.Data}})
	if err != nil {
		return response.InternalError(c, err.Error())
	}

	return c.JSON(fiber.Map{"success": true})
}

/* GET /statistics/waitlist - Returns pending users */
func (ctrl *Controller) UserWaitlist(c *fiber.Ctx) error {
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	limit := c.QueryInt("limit", 10)
	if limit < 1 {
		limit = 10
	}
	skip := (page - 1) * limit
	search := strings.TrimSpace(c.Query("search", ""))

	waitlistColl := ctrl.db.Collection("waitlists")
	
	filter := bson.M{}
	if search != "" {
		filter = bson.M{
			"$or": []bson.M{
				{"id": bson.M{"$regex": search, "$options": "i"}},
				{"name": bson.M{"$regex": search, "$options": "i"}},
				{"mail": bson.M{"$regex": search, "$options": "i"}},
			},
		}
	}

	total, err := waitlistColl.Find(c.Context(), bson.M{}).Count()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to count waitlist users"})
	}

	var users []bson.M
	err = waitlistColl.Find(c.Context(), filter).
		Skip(int64(skip)).
		Limit(int64(limit)).
		All(&users)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch waitlist users"})
	}

	return c.JSON(fiber.Map{
		"total": total,
		"page":  page,
		"limit": limit,
		"data":  users,
	})
}

func (ctrl *Controller) ApproveWaitlistUser(c *fiber.Ctx) error {
	waitUserId := c.Params("waitUserId")
	if waitUserId == "" {
		return response.BadRequest(c, "Waitlist user ID required")
	}
	
	waitlistColl := ctrl.db.Collection("waitlists")
	usersColl := ctrl.db.Collection("users")
	
	var waitlistUser bson.M
	err := waitlistColl.Find(c.Context(), bson.M{"id": waitUserId}).One(&waitlistUser)
	if err != nil {
		return response.NotFound(c, "Waitlist record not found")
	}
	
	userCount, err := usersColl.Find(c.Context(), bson.M{"id": waitUserId}).Count()
	if err == nil && userCount > 0 {
		return response.BadRequest(c, "User already exists")
	}
	
	now := time.Now()
	newUser := bson.M{
		"id":             waitlistUser["id"],
		"name":           waitlistUser["name"],
		"mail":           waitlistUser["mail"],
		"password":       waitlistUser["password"],
		"roles":          []string{"subscriber"},
		"confirmed":      true,
		"rejected":       false,
		"meta":           waitlistUser["meta"],
		"limitNodes":     300,
		"limitWorkflows": 10,
		"createdAt":      now,
		"updatedAt":      now,
	}
	
	_, err = usersColl.InsertOne(c.Context(), newUser)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}
	
	err = waitlistColl.Remove(c.Context(), bson.M{"id": waitUserId})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to remove waitlist record"})
	}
	
	return c.JSON(fiber.Map{"success": true})
}

/* GET /statistics/waitlist/reject/:waitUserId - reject waitlist user */
func (ctrl *Controller) RejectWaitlistUser(c *fiber.Ctx) error {
	waitUserId := c.Params("waitUserId")
	if waitUserId == "" {
		return response.BadRequest(c, "Waitlist user ID required")
	}
	
	waitlistColl := ctrl.db.Collection("waitlists")
	
	var waitlistUser bson.M
	err := waitlistColl.Find(c.Context(), bson.M{"id": waitUserId}).One(&waitlistUser)
	if err != nil {
		return response.NotFound(c, "Waitlist record not found")
	}
	
	err = waitlistColl.Remove(c.Context(), bson.M{"id": waitUserId})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete waitlist record"})
	}
	
	return c.JSON(fiber.Map{"success": true})
}

/* POST /statistics/waitlist/confirm/all - batch approve */
func (ctrl *Controller) ActivateUsersBatch(c *fiber.Ctx) error {
	var payload struct {
		Ids []string `json:"ids"`
	}
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return response.BadRequest(c, "Invalid JSON")
	}
	if len(payload.Ids) == 0 {
		return response.BadRequest(c, "No user IDs provided")
	}
	
	waitlistColl := ctrl.db.Collection("waitlists")
	usersColl := ctrl.db.Collection("users")
	results := make([]fiber.Map, 0, len(payload.Ids))
	
	for _, userId := range payload.Ids {
		var waitlistUser bson.M
		err := waitlistColl.Find(c.Context(), bson.M{"id": userId}).One(&waitlistUser)
		if err != nil {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "Waitlist record not found"})
			continue
		}
		
		userCount, err := usersColl.Find(c.Context(), bson.M{"id": userId}).Count()
		if err == nil && userCount > 0 {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "User already exists"})
			continue
		}
		
		now := time.Now()
		newUser := bson.M{
			"id":             waitlistUser["id"],
			"name":           waitlistUser["name"],
			"mail":           waitlistUser["mail"],
			"password":       waitlistUser["password"],
			"roles":          []string{"subscriber"},
			"confirmed":      true,
			"rejected":       false,
			"meta":           waitlistUser["meta"],
			"limitNodes":     300,
			"limitWorkflows": 10,
			"createdAt":      now,
			"updatedAt":      now,
		}
		
		_, err = usersColl.InsertOne(c.Context(), newUser)
		if err != nil {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "Failed to create user"})
			continue
		}
		
		err = waitlistColl.Remove(c.Context(), bson.M{"id": userId})
		if err != nil {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "Failed to remove waitlist record"})
			continue
		}
		
		results = append(results, fiber.Map{"id": userId, "success": true})
	}
	
	return c.JSON(fiber.Map{"results": results})
}

/* POST /statistics/waitlist/reject/all - batch reject */
func (ctrl *Controller) RejectUsersBatch(c *fiber.Ctx) error {
	var payload struct {
		Ids []string `json:"ids"`
	}
	if err := json.Unmarshal(c.Body(), &payload); err != nil {
		return response.BadRequest(c, "Invalid JSON")
	}
	if len(payload.Ids) == 0 {
		return response.BadRequest(c, "No user IDs provided")
	}
	
	waitlistColl := ctrl.db.Collection("waitlists")
	results := make([]fiber.Map, 0, len(payload.Ids))
	
	for _, userId := range payload.Ids {
		var waitlistUser bson.M
		err := waitlistColl.Find(c.Context(), bson.M{"id": userId}).One(&waitlistUser)
		if err != nil {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "Waitlist record not found"})
			continue
		}
		
		err = waitlistColl.Remove(c.Context(), bson.M{"id": userId})
		if err != nil {
			results = append(results, fiber.Map{"id": userId, "success": false, "error": "Failed to delete waitlist record"})
			continue
		}
		
		results = append(results, fiber.Map{"id": userId, "success": true})
	}
	
	return c.JSON(fiber.Map{"results": results})
}
