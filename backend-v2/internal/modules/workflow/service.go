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

const (
	workflowUploadDrainTimeout  = 2 * time.Second
	workflowUploadDrainInterval = 25 * time.Millisecond
	workflowUploadLeaseTTL      = 5 * time.Minute
	workflowUploadLeaseRenewal  = time.Minute
)

func NewService(db *qmgo.Database) *WorkflowService {
	return &WorkflowService{
		Collection: db.Collection("workflows"),
	}
}

func (s *WorkflowService) GetByWorkflowID(ctx context.Context, workflowId string) (*models.Workflow, error) {
	var wf models.Workflow
	err := s.Collection.Find(ctx, qmgo.M{
		"workflowId":      workflowId,
		"deletionPending": qmgo.M{"$ne": true},
	}).One(&wf)

	if err != nil {
		return nil, err
	}
	return &wf, nil
}

func (s *WorkflowService) UpdateWorkflow(ctx context.Context, workflowId string, update *models.WorkflowUpdateDTO) error {
	filter := map[string]string{"workflowId": workflowId}

	/* Build selective update - only set fields that are explicitly provided (non-nil pointers) */
	setDoc := qmgo.M{
		"updatedAt": time.Now().Unix() * 1000,
	}

	if update.Nodes != nil {
		reconcileNodeTitleProjections(*update.Nodes)
		setDoc["nodes"] = *update.Nodes
	}
	if update.Edges != nil {
		setDoc["edges"] = *update.Edges
	}
	if update.Root != nil {
		setDoc["root"] = *update.Root
	}
	if update.Title != nil {
		setDoc["title"] = *update.Title
	}
	if update.Files != nil {
		setDoc["files"] = *update.Files
	}
	if update.Category != nil {
		setDoc["category"] = *update.Category
	}

	updateDoc := qmgo.M{
		"$set": setDoc,
	}

	err := s.Collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return err
	}

	return nil
}

// reconcileNodeTitleProjections enforces the node/titleProjection invariant at
// the write boundary: a projection whose recorded source title no longer
// matches its node title is dropped, so a raw API write cannot persist
// contradictory provenance the client-side sanitizer would normally remove.
func reconcileNodeTitleProjections(nodes map[string]models.Node) {
	for id, node := range nodes {
		node.ClearStaleTitleProjection()
		nodes[id] = node
	}
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
	query["deletionPending"] = qmgo.M{"$ne": true}

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
		project = qmgo.M{"edges": 0}
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
	total, err := s.Collection.Find(ctx, qmgo.M{
		"userId":          dto.UserID,
		"deletionPending": qmgo.M{"$ne": true},
	}).Count()
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
		Title:      dto.Title,
		UpdatedAt:  time.Now().Unix() * 1000, // Milliseconds timestamp for frontend compatibility
		Share:      share,
	}

	_, err = s.Collection.InsertOne(ctx, data)

	if err != nil {
		return nil, errors.NewHTTPError(500, "Failed to insert workflow into database")
	}

	return &data, nil
}

func validateWorkflowDeleteAccess(access WorkflowAccess) *errors.HTTPError {
	if !access.IsOwner {
		return errors.NewHTTPError(403, "You are not an owner of this workflow.")
	}
	return nil
}

func (s *WorkflowService) BeginWorkflowDeletion(
	ctx context.Context,
	workflowId string,
	access WorkflowAccess,
) *errors.HTTPError {
	if err := validateWorkflowDeleteAccess(access); err != nil {
		return err
	}

	err := s.Collection.UpdateOne(ctx, qmgo.M{"workflowId": workflowId}, qmgo.M{
		"$set": qmgo.M{"deletionPending": true},
	})
	if err != nil {
		return errors.NewHTTPError(500, "Can not begin workflow removal")
	}
	return nil
}

func (s *WorkflowService) WaitForWorkflowFileUploads(ctx context.Context, workflowId string) *errors.HTTPError {
	deadline := time.NewTimer(workflowUploadDrainTimeout)
	defer deadline.Stop()
	ticker := time.NewTicker(workflowUploadDrainInterval)
	defer ticker.Stop()

	for {
		reapErr := s.Collection.UpdateOne(ctx, qmgo.M{
			"workflowId":      workflowId,
			"deletionPending": true,
		}, qmgo.M{
			"$pull": qmgo.M{
				"activeFileUploads": qmgo.M{"expiresAt": qmgo.M{"$lte": time.Now().UnixMilli()}},
			},
		})
		if reapErr != nil {
			return errors.NewHTTPError(500, "Can not reconcile workflow file upload leases")
		}

		var workflow models.Workflow
		err := s.Collection.Find(ctx, qmgo.M{
			"workflowId":      workflowId,
			"deletionPending": true,
		}).One(&workflow)
		if err != nil {
			return errors.NewHTTPError(500, "Can not inspect active workflow file uploads")
		}
		if len(workflow.ActiveFileUploads) == 0 {
			return nil
		}

		select {
		case <-ctx.Done():
			return errors.NewHTTPError(409, "Workflow deletion is waiting for active file uploads")
		case <-deadline.C:
			return errors.NewHTTPError(409, "Workflow deletion is waiting for active file uploads")
		case <-ticker.C:
		}
	}
}

func (s *WorkflowService) FinalizeWorkflowDeletion(ctx context.Context, workflowId string) *errors.HTTPError {
	err := s.Collection.Remove(ctx, qmgo.M{
		"workflowId":      workflowId,
		"deletionPending": true,
		"$or": qmgo.A{
			qmgo.M{"activeFileUploads": qmgo.M{"$exists": false}},
			qmgo.M{"activeFileUploads": qmgo.M{"$size": 0}},
		},
	})

	if err != nil {
		return errors.NewHTTPError(500, "Can not remove")
	}

	return nil
}

func (s *WorkflowService) BeginWorkflowFileUpload(
	ctx context.Context,
	workflowId string,
	operationId string,
) *errors.HTTPError {
	err := s.Collection.UpdateOne(ctx, qmgo.M{
		"workflowId":      workflowId,
		"deletionPending": qmgo.M{"$ne": true},
	}, qmgo.M{
		"$addToSet": qmgo.M{"activeFileUploads": models.WorkflowFileUploadLease{
			ID:        operationId,
			ExpiresAt: time.Now().Add(workflowUploadLeaseTTL).UnixMilli(),
		}},
	})
	if err == qmgo.ErrNoSuchDocuments {
		return errors.NewHTTPError(409, "Workflow is no longer active")
	}
	if err != nil {
		return errors.NewHTTPError(500, "Can not reserve workflow file upload")
	}
	return nil
}

func (s *WorkflowService) CompleteWorkflowFileUpload(
	ctx context.Context,
	workflowId string,
	operationId string,
) *errors.HTTPError {
	err := s.Collection.UpdateOne(ctx, qmgo.M{"workflowId": workflowId}, qmgo.M{
		"$pull": qmgo.M{"activeFileUploads": qmgo.M{"id": operationId}},
	})
	if err != nil {
		return errors.NewHTTPError(500, "Can not release workflow file upload reservation")
	}
	return nil
}

func (s *WorkflowService) RenewWorkflowFileUpload(
	ctx context.Context,
	workflowId string,
	operationId string,
) *errors.HTTPError {
	err := s.Collection.UpdateOne(ctx, qmgo.M{
		"workflowId":           workflowId,
		"activeFileUploads.id": operationId,
	}, qmgo.M{
		"$set": qmgo.M{
			"activeFileUploads.$.expiresAt": time.Now().Add(workflowUploadLeaseTTL).UnixMilli(),
		},
	})
	if err != nil {
		return errors.NewHTTPError(500, "Can not renew workflow file upload lease")
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
