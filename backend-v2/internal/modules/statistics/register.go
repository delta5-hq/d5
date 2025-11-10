package statistics

import (
	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

func Register(router fiber.Router, db *qmgo.Database) {
	controller := NewController(db)

	statsGroup := router.Group("/statistics")
	statsGroup.Use(controller.Authorization)

	statsGroup.Get("/workflow", controller.WorkflowServe)
	statsGroup.Get("/workflow/download", controller.WorkflowCsv)
	statsGroup.Get("/users", controller.UserList)
	statsGroup.Get("/users/activity", controller.UserActivity)
	statsGroup.Get("/workflow/:userId", controller.UserWorkflowStatistics)
	statsGroup.Get("/users/:userId", controller.UserStatistics)
	statsGroup.Post("/users/:userId/comment", controller.UserComment)
	statsGroup.Get("/waitlist", controller.UserWaitlist)
	statsGroup.Get("/waitlist/confirm/:waitUserId", controller.ApproveWaitlistUser)
	statsGroup.Get("/waitlist/reject/:waitUserId", controller.RejectWaitlistUser)
	statsGroup.Post("/waitlist/confirm/all", controller.ActivateUsersBatch)
	statsGroup.Post("/waitlist/reject/all", controller.RejectUsersBatch)
}
