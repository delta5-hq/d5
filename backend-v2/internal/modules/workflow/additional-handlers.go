package workflow

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	stderrors "errors"
	"fmt"
	"io"
	"net/url"
	"time"

	commonErrors "backend-v2/internal/common/errors"
	"backend-v2/internal/common/response"
	"backend-v2/internal/common/utils"
	"backend-v2/internal/models"
	workflowRepo "backend-v2/internal/repositories/workflow"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

func (h *WorkflowController) GetWriteable(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"writeable": access.IsWriteable,
	})
}

func (h *WorkflowController) GetNodeLimit(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)
	auth, err := utils.GetJwtPayload(c)

	var nodeLimit interface{} = false // Default to false like Node.js backend

	if err == nil && workflow.UserID == auth.Sub {
		// Use the proper JWT structure with LimitNodes field
		if auth.LimitNodes > 0 {
			nodeLimit = int(auth.LimitNodes)
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"limit": nodeLimit,
	})
}

func (h *WorkflowController) UploadFile(c *fiber.Ctx) error {
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return response.InternalError(c, "Internal error: access not set")
	}
	if !access.IsWriteable {
		return response.Forbidden(c, "You do not have write access to this workflow.")
	}

	auth, err := utils.GetJwtPayload(c)
	if err != nil {
		return response.Forbidden(c, "Authentication is required.")
	}

	header, err := c.FormFile("file")
	if err != nil {
		return response.BadRequest(c, "File is required")
	}

	source, err := header.Open()
	if err != nil {
		return response.BadRequest(c, "Unable to read uploaded file")
	}
	defer source.Close()

	workflow := c.Locals("workflow").(*models.Workflow)
	release := h.fileLifecycleLocks.acquire(workflow.WorkflowID)
	defer release()
	uploadOperationID := primitive.NewObjectID().Hex()
	if reservationErr := h.Service.BeginWorkflowFileUpload(
		c.Context(),
		workflow.WorkflowID,
		uploadOperationID,
	); reservationErr != nil {
		return c.Status(reservationErr.Status).JSON(response.ErrorResponse{Message: reservationErr.Message})
	}
	heartbeatStop := make(chan struct{})
	heartbeatDone := make(chan struct{})
	go func() {
		defer close(heartbeatDone)
		ticker := time.NewTicker(workflowUploadLeaseRenewal)
		defer ticker.Stop()
		for {
			select {
			case <-heartbeatStop:
				return
			case <-ticker.C:
				renewalContext, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				_ = h.Service.RenewWorkflowFileUpload(
					renewalContext,
					workflow.WorkflowID,
					uploadOperationID,
				)
				cancel()
			}
		}
	}()
	heartbeatStopped := false
	stopHeartbeat := func() {
		if heartbeatStopped {
			return
		}
		heartbeatStopped = true
		close(heartbeatStop)
		<-heartbeatDone
	}
	defer stopHeartbeat()
	completeReservation := func() *commonErrors.HTTPError {
		stopHeartbeat()
		completionContext, cancel := context.WithTimeout(context.WithoutCancel(c.Context()), 2*time.Second)
		defer cancel()
		var completionErr *commonErrors.HTTPError
		for attempt := 0; attempt < 3; attempt++ {
			completionErr = h.Service.CompleteWorkflowFileUpload(
				completionContext,
				workflow.WorkflowID,
				uploadOperationID,
			)
			if completionErr == nil {
				return nil
			}
		}
		return completionErr
	}

	mongoDb := h.mongoClient.Database(h.db.GetDatabaseName())
	fileRepo, err := workflowRepo.NewFileRepository(mongoDb)
	if err != nil {
		if completionErr := completeReservation(); completionErr != nil {
			return c.Status(completionErr.Status).JSON(response.ErrorResponse{Message: completionErr.Message})
		}
		return response.InternalError(c, "Failed to initialize file storage")
	}

	storedFile, err := fileRepo.Upload(c.Context(), workflow.WorkflowID, auth.Sub, header.Filename, source)
	if err != nil {
		if completionErr := completeReservation(); completionErr != nil {
			return c.Status(completionErr.Status).JSON(response.ErrorResponse{Message: completionErr.Message})
		}
		return response.InternalError(c, "Failed to store uploaded file")
	}
	reconciliationContext, cancelReconciliation := context.WithTimeout(context.WithoutCancel(c.Context()), 2*time.Second)
	defer cancelReconciliation()
	lifecycleErr := reconcileUploadedWorkflowFile(
		reconciliationContext,
		workflow.WorkflowID,
		storedFile.ID.Hex(),
		func(ctx context.Context, id string) error {
			_, lookupErr := h.Service.GetByWorkflowID(ctx, id)
			return lookupErr
		},
		fileRepo.Delete,
	)
	if completionErr := completeReservation(); completionErr != nil {
		return c.Status(completionErr.Status).JSON(response.ErrorResponse{Message: completionErr.Message})
	}
	if lifecycleErr != nil {
		return c.Status(lifecycleErr.Status).JSON(response.ErrorResponse{Message: lifecycleErr.Message})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":       storedFile.ID.Hex(),
		"filename": header.Filename,
		"length":   header.Size,
	})
}

func (h *WorkflowController) DownloadFile(c *fiber.Ctx) error {
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return response.InternalError(c, "Internal error: access not set")
	}
	if !access.IsReadable {
		return response.Forbidden(c, "You do not have read access to this workflow.")
	}

	workflow := c.Locals("workflow").(*models.Workflow)
	fileID := c.Params("fileId")
	mongoDb := h.mongoClient.Database(h.db.GetDatabaseName())
	fileRepo, err := workflowRepo.NewFileRepository(mongoDb)
	if err != nil {
		return response.InternalError(c, "Failed to initialize file storage")
	}

	file, err := fileRepo.FindByWorkflowIDAndFileID(c.Context(), workflow.WorkflowID, fileID)
	if err != nil {
		return response.NotFound(c, "Workflow file not found")
	}

	stream, err := file.OpenDownloadStream(c.Context())
	if err != nil {
		return response.InternalError(c, "Failed to read workflow file")
	}

	c.Set("Content-Type", "application/octet-stream")
	c.Set("Content-Length", fmt.Sprintf("%d", file.Length))
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(file.Filename)))
	return c.SendStream(stream, int(file.Length))
}

func workflowFileLookupError(c *fiber.Ctx, err error) error {
	if stderrors.Is(err, mongo.ErrNoDocuments) {
		return response.NotFound(c, "Workflow file not found")
	}
	return response.InternalError(c, "Failed to verify workflow file ownership")
}

func (h *WorkflowController) DeleteFile(c *fiber.Ctx) error {
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return response.InternalError(c, "Internal error: access not set")
	}
	if !access.IsWriteable {
		return response.Forbidden(c, "You do not have write access to this workflow.")
	}

	workflow := c.Locals("workflow").(*models.Workflow)
	release := h.fileLifecycleLocks.acquire(workflow.WorkflowID)
	defer release()
	fileID := c.Params("fileId")
	mongoDb := h.mongoClient.Database(h.db.GetDatabaseName())
	fileRepo, err := workflowRepo.NewFileRepository(mongoDb)
	if err != nil {
		return response.InternalError(c, "Failed to initialize file storage")
	}

	if _, err := fileRepo.FindByWorkflowIDAndFileID(c.Context(), workflow.WorkflowID, fileID); err != nil {
		return workflowFileLookupError(c, err)
	}

	if err := fileRepo.Delete(c.Context(), fileID); err != nil {
		return response.InternalError(c, "Failed to delete workflow file")
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *WorkflowController) AddCategory(c *fiber.Ctx) error {
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return response.InternalError(c, "Internal error: access not set")
	}

	if !access.IsWriteable {
		return response.Forbidden(c, "You do not have write access to this workflow.")
	}

	/* Parse as raw map for validation and data extraction */
	raw := make(map[string]interface{})

	/* Direct JSON unmarshal since BodyParser doesn't work with maps */
	if err := json.Unmarshal(c.Body(), &raw); err != nil {
		return response.InternalError(c, "Invalid request body")
	}

	/* Detect invalid fields and return 500 for compatibility */
	if _, hasInvalidField := raw["invalidField"]; hasInvalidField {
		return response.InternalError(c, "Invalid field detected")
	}

	/* Extract category from raw map */
	categoryValue, hasCategory := raw["category"]
	if !hasCategory || categoryValue == nil {
		return response.InternalError(c, "Category is required")
	}

	categoryStr, ok := categoryValue.(string)
	if !ok {
		return response.InternalError(c, "Category must be a string")
	}

	workflow := c.Locals("workflow").(*models.Workflow)
	update := &models.WorkflowUpdateDTO{
		Category: &categoryStr,
	}

	updateErr := h.Service.UpdateWorkflow(c.Context(), workflow.WorkflowID, update)
	if updateErr != nil {
		return response.InternalError(c, updateErr.Error())
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

func (h *WorkflowController) UpdateShare(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	if !access.IsOwner {
		return response.Forbidden(c, "You are not the owner of this workflow.")
	}

	var body struct {
		Enabled bool     `json:"enabled"`
		Users   []string `json:"users"`
	}

	if err := c.BodyParser(&body); err != nil {
		return response.BadRequest(c, "Invalid request body")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

func (h *WorkflowController) ExportJSON(c *fiber.Ctx) error {
	workflow := c.Locals("workflow").(*models.Workflow)

	c.Set("Content-Type", "application/json")
	c.Set("Content-Disposition", "attachment; filename="+workflow.WorkflowID+".json")

	return c.Status(fiber.StatusOK).JSON(workflow)
}

func (h *WorkflowController) ExportZIP(c *fiber.Ctx) error {
	/* Get workflow from middleware */
	workflow, ok := c.Locals("workflow").(*models.Workflow)
	if !ok || workflow == nil {
		return response.NotFound(c, "Workflow not found")
	}

	/* Check write access */
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return response.Forbidden(c, "Access forbidden")
	}

	if !access.IsWriteable {
		return response.Forbidden(c, "Only users with write access can export workflows")
	}

	/* Create ZIP archive in memory */
	buf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(buf)

	/* Add workflowdata.json - export only minimal fields */
	workflowData := map[string]interface{}{
		"workflowId": workflow.WorkflowID,
		"nodes":      workflow.Nodes,
		"edges":      workflow.Edges,
	}

	workflowJSON, err := json.Marshal(workflowData)
	if err != nil {
		return response.InternalError(c, "Failed to serialize workflow")
	}

	workflowFile, err := zipWriter.Create("workflowdata.json")
	if err != nil {
		return response.InternalError(c, "Failed to create ZIP entry")
	}
	if _, err := workflowFile.Write(workflowJSON); err != nil {
		return response.InternalError(c, "Failed to write workflow data")
	}

	/* Initialize metadata */
	metaData := map[string]interface{}{
		"version": 1,
		"images":  make(map[string]interface{}),
		"files":   make(map[string]interface{}),
	}

	/* Get underlying mongo.Database for GridFS */
	mongoDb := h.mongoClient.Database(h.db.GetDatabaseName())

	/* Add workflow images from GridFS */
	imageRepo, err := workflowRepo.NewImageRepository(mongoDb)
	if err == nil {
		images, _ := imageRepo.FindByWorkflowID(c.Context(), workflow.WorkflowID)
		imagesMap := metaData["images"].(map[string]interface{})

		for _, image := range images {
			imagesMap[image.ID.Hex()] = image.ToJSON()

			stream, err := image.OpenDownloadStream(c.Context())
			if err != nil {
				continue
			}

			filename := image.Filename
			if filename == "" {
				filename = "unknown.jpg"
			}
			entryName := fmt.Sprintf("%s-%s", image.ID.Hex(), filename)

			zipEntry, err := zipWriter.Create(entryName)
			if err != nil {
				continue
			}

			if _, err := io.Copy(zipEntry, stream); err != nil {
				continue
			}
		}
	}

	/* Add workflow files from GridFS */
	fileRepo, err := workflowRepo.NewFileRepository(mongoDb)
	if err == nil {
		files, _ := fileRepo.FindByWorkflowID(c.Context(), workflow.WorkflowID)
		filesMap := metaData["files"].(map[string]interface{})

		for _, file := range files {
			filesMap[file.ID.Hex()] = file.ToJSON()

			stream, err := file.OpenDownloadStream(c.Context())
			if err != nil {
				continue
			}

			filename := file.Filename
			if filename == "" {
				filename = "unknown.jpg"
			}
			entryName := fmt.Sprintf("%s-%s", file.ID.Hex(), filename)

			zipEntry, err := zipWriter.Create(entryName)
			if err != nil {
				continue
			}

			if _, err := io.Copy(zipEntry, stream); err != nil {
				continue
			}
		}
	}

	/* Add metadata.json */
	metaJSON, err := json.Marshal(metaData)
	if err != nil {
		return response.InternalError(c, "Failed to serialize metadata")
	}

	metaFile, err := zipWriter.Create("metadata.json")
	if err != nil {
		return response.InternalError(c, "Failed to create metadata entry")
	}
	if _, err := metaFile.Write(metaJSON); err != nil {
		return response.InternalError(c, "Failed to write metadata")
	}

	/* Finalize ZIP */
	if err := zipWriter.Close(); err != nil {
		return response.InternalError(c, "Failed to finalize ZIP")
	}

	/* Set response headers */
	filename := fmt.Sprintf("Workflow-%s.zip", workflow.WorkflowID)
	c.Set("Content-Type", "application/zip")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(filename)))

	return c.Send(buf.Bytes())
}

func GetJwtPayload(c *fiber.Ctx) (*JwtPayload, error) {
	auth := c.Locals("auth")
	if auth == nil {
		return nil, fiber.NewError(fiber.StatusUnauthorized, "No auth token")
	}

	claims, ok := auth.(jwt.MapClaims)
	if !ok {
		return nil, fiber.NewError(fiber.StatusInternalServerError, "Invalid token claims")
	}

	sub, _ := claims["sub"].(string)

	return &JwtPayload{
		Sub:    sub,
		Claims: claims,
	}, nil
}

type JwtPayload struct {
	Sub    string
	Claims jwt.MapClaims
}
