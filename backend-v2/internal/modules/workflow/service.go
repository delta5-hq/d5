package workflow

import (
	"context"
	"fmt"
	"strings"
	"time"

	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/errors"
	"backend-v2/internal/common/utils"
	"backend-v2/internal/models"

	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WorkflowService struct {
	Collection *qmgo.Collection
}

func NewService(db *qmgo.Database) *WorkflowService {
	return &WorkflowService{
		Collection: db.Collection("workflows"),
	}
}

func (s *WorkflowService) GetByWorkflowID(ctx context.Context, workflowId string) (*models.Workflow, error) {
	var wf models.Workflow
	err := s.Collection.Find(ctx, map[string]string{"workflowId": workflowId}).One(&wf)

	if err != nil {
		return nil, err
	}
	return &wf, nil
}

func (s *WorkflowService) UpdateWorkflow(ctx context.Context, workflowId string, update *models.Workflow) error {
	filter := map[string]string{"workflowId": workflowId}

	/* Always update timestamp */
	update.UpdatedAt = time.Now().Unix() * 1000

	updateDoc := map[string]*models.Workflow{
		"$set": update,
	}

	err := s.Collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return err
	}

	return nil
}

func (s *WorkflowService) GetWorkflows(ctx context.Context, dto GetWorkflowsQuery) ([]models.Workflow, int64, error) {
	var query qmgo.M

	if dto.IsPublic {
		query = qmgo.M{
			"share.public.enabled": true,
			"$or": qmgo.A{
				qmgo.M{"share.public.hidden": false},
				qmgo.M{"share.public.hidden": qmgo.M{"$exists": false}},
			},
		}
	} else {
		query = qmgo.M{
			"$or": qmgo.A{
				qmgo.M{"userId": dto.UserID},
				qmgo.M{
					"share.access.subjectId":   dto.UserID,
					"share.access.subjectType": "user",
				},
			},
		}

		switch dto.ShareFilter {
		case Private:
			query["share.public.enabled"] = qmgo.M{"$ne": true}
		case Public:
			query["share.public.enabled"] = true
			query["share.public.hidden"] = false
		case Hidden:
			query["share.public.enabled"] = true
			query["share.public.hidden"] = true
		}
	}

	search := dto.GetSearch()
	if search != "" {
		query["title"] = qmgo.M{
			"$regex":   search,
			"$options": "i",
		}
	}

	var project qmgo.M
	if dto.IsPublic {
		project = qmgo.M{"nodes": 0, "edges": 0, "share": 0}
	} else {
		project = qmgo.M{"nodes": 0, "edges": 0}
	}

	total, err := s.Collection.Find(ctx, query).Count()
	if err != nil {
		return nil, 0, err
	}

	page := dto.GetPage()
	limit := dto.GetLimit()
	skip := int64((page - 1) * limit)

	results := make([]models.Workflow, 0)

	err = s.Collection.
		Find(ctx, query).
		Sort("-updatedAt").
		Select(project).
		Skip(skip).
		Limit(int64(limit)).
		All(&results)

	if err != nil {
		return nil, 0, err
	}

	return results, total, nil
}

func (s *WorkflowService) CreateWorkflow(ctx context.Context, dto CreateWorkflowDto) (*models.Workflow, *errors.HTTPError) {
	total, err := s.Collection.Find(ctx, qmgo.M{"userId": dto.UserID}).Count()
	if err != nil {
		return nil, errors.NewHTTPError(404, "User not found")
	}

	limit := dto.GetLimit()

	/* Allow unlimited workflows only for org_subscribers (matching Node.js backend) */
	isOrgSubscriber := utils.Contains(dto.Auth.Roles, string(constants.Org_subscriber))

	if limit > 0 && total >= limit && !isOrgSubscriber {
		return nil, errors.NewHTTPError(402, fmt.Sprintf("Workflow limit reached %v", limit))
	}

	workflowId := utils.GenerateID()

	/* Use provided share data or default to empty */
	share := models.Share{
		Public: models.WorkflowState{
			Enabled:   false,
			Writeable: false,
			Hidden:    false,
		},
		Access: make([]models.RoleBinding, 0),
	}

	if dto.Share != nil {
		share = *dto.Share
	}

	data := models.Workflow{
		UserID:     dto.UserID,
		WorkflowID: workflowId,
		Title:      "",
		UpdatedAt:  time.Now().Unix() * 1000, // Milliseconds timestamp for frontend compatibility
		Share:      share,
	}

	_, err = s.Collection.InsertOne(ctx, data)

	if err != nil {
		return nil, errors.NewHTTPError(500, "Failed to insert workflow into database")
	}

	return &data, nil
}

func (s *WorkflowService) DeleteWorkflow(ctx context.Context, workflowId string, access WorkflowAccess) *errors.HTTPError {
	if !access.IsOwner {
		return errors.NewHTTPError(403, "You are not an owner of this workflow.")
	}

	err := s.Collection.Remove(ctx, qmgo.M{
		"workflowId": workflowId,
	})

	if err != nil {
		return errors.NewHTTPError(500, "Can not remove")
	}

	return nil
}

func (s *WorkflowService) SetShareAccess(
	ctx context.Context,
	workflow *models.Workflow,
	access WorkflowAccess,
	update []*models.RoleBinding,
) *errors.HTTPError {
	if !access.IsOwner {
		return errors.NewHTTPError(403, "You are not an owner of this workflow.")
	}

	/* Validate access list entries */
	validRoles := map[constants.AccessRole]bool{
		constants.Owner:       true,
		constants.Contributor: true,
		constants.Reader:      true,
	}

	validSubjectTypes := map[constants.SubjectType]bool{
		"user":  true,
		"mail":  true,
		"group": true,
	}

	hasValidEntry := len(update) == 0 /* Empty list is valid */

	for _, binding := range update {
		/* Validate role */
		if binding.Role == "" || !validRoles[binding.Role] {
			return errors.NewHTTPError(400, "Invalid or missing role in access list")
		}

		/* Validate subjectType */
		if binding.SubjectType == "" || !validSubjectTypes[binding.SubjectType] {
			return errors.NewHTTPError(400, "Invalid or missing subject type in access list")
		}

		/* Validate subjectID */
		if binding.SubjectID == "" {
			continue /* Skip empty subjectID for now, will validate below */
		}

		/* Reject SQL injection attempts */
		if strings.Contains(binding.SubjectID, "'") || strings.Contains(binding.SubjectID, "\"") ||
			strings.Contains(binding.SubjectID, "--") || strings.Contains(binding.SubjectID, ";") {
			return errors.NewHTTPError(400, "Invalid subject ID")
		}

		/* Reject XSS attempts */
		if strings.Contains(binding.SubjectID, "<") || strings.Contains(binding.SubjectID, ">") {
			return errors.NewHTTPError(400, "Invalid subject ID")
		}

		hasValidEntry = true
	}

	/* If all entries have empty subjectID, reject */
	if !hasValidEntry {
		for _, binding := range update {
			if binding.SubjectID == "" {
				return errors.NewHTTPError(400, "Invalid or missing subject ID in access list")
			}
		}
	}

	filter := map[string]string{"workflowId": workflow.WorkflowID}

	updateDoc := map[string]any{
		"$set": map[string]any{
			"share.access": update,
		},
	}

	err := s.Collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return errors.NewHTTPError(500, err.Error())
	}

	return nil
}

func (s *WorkflowService) SetSharePublic(
	ctx context.Context,
	workflow *models.Workflow,
	access WorkflowAccess,
	update *models.WorkflowState,
	userRoles []string,
) *errors.HTTPError {
	/* Only administrators can set public writeable workflows */
	if update.Writeable && !update.Hidden {
		isAdmin := false
		for _, role := range userRoles {
			if role == string(constants.Administrator) {
				isAdmin = true
				break
			}
		}
		if !isAdmin {
			return errors.NewHTTPError(403, "Only administrators can set workflows public writeable")
		}
	}

	if !access.IsOwner {
		return errors.NewHTTPError(403, "You are not an owner of this workflow.")
	}

	filter := map[string]string{"workflowId": workflow.WorkflowID}

	updateDoc := map[string]any{
		"$set": map[string]any{
			"share.public": update,
		},
	}

	err := s.Collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return errors.NewHTTPError(500, err.Error())
	}

	return nil
}

func (s *WorkflowService) CreateWorkflowFromTemplate(ctx context.Context, template *models.WorkflowTemplate, userId string) (*models.WorkflowTemplate, *errors.HTTPError) {
	data := models.WorkflowTemplate{
		TemplateID:      primitive.NewObjectID(),
		UserID:          userId,
		Name:            template.Name,
		Keywords:        template.Keywords,
		Root:            template.Root,
		Share:           template.Share,
		BackgroundImage: template.BackgroundImage,
		Nodes:           template.Nodes,
		Edges:           template.Edges,
	}

	_, err := s.Collection.InsertOne(ctx, data)
	if err != nil {
		return nil, errors.NewHTTPError(500, err.Error())
	}

	return &data, nil
}
