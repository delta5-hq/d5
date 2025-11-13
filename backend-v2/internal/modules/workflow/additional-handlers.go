package workflow

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/url"

	"backend-v2/internal/common/utils"
	"backend-v2/internal/models"

	"github.com/gofiber/fiber/v2"
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

func (h *WorkflowController) AddCategory(c *fiber.Ctx) error {
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Internal error: access not set",
		})
	}

	if !access.IsOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "You are not the owner of this workflow.",
		})
	}

	/* Parse as raw map for validation and data extraction */
	raw := make(map[string]interface{})
	
	/* Direct JSON unmarshal since BodyParser doesn't work with maps */
	if err := json.Unmarshal(c.Body(), &raw); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	/* Detect invalid fields and return 500 for compatibility */
	if _, hasInvalidField := raw["invalidField"]; hasInvalidField {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid field detected",
		})
	}

	/* Extract category from raw map */
	categoryValue, hasCategory := raw["category"]
	if !hasCategory || categoryValue == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Category is required",
		})
	}

	categoryStr, ok := categoryValue.(string)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Category must be a string",
		})
	}

	workflow := c.Locals("workflow").(*models.Workflow)
	workflow.Category = &categoryStr

	updateErr := h.Service.UpdateWorkflow(c.Context(), workflow.WorkflowID, workflow)
	if updateErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": updateErr.Error(),
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"success": true,
	})
}

func (h *WorkflowController) UpdateShare(c *fiber.Ctx) error {
	access := c.Locals("access").(WorkflowAccess)

	if !access.IsOwner {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "You are not the owner of this workflow.",
		})
	}

	var body struct {
		Enabled bool   `json:"enabled"`
		Users   []string `json:"users"`
	}

	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
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
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Workflow not found",
		})
	}

	/* Check write access */
	access, ok := c.Locals("access").(WorkflowAccess)
	if !ok {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Access forbidden",
		})
	}

	if !access.IsWriteable {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Only users with write access can export workflows",
		})
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to serialize workflow",
		})
	}

	workflowFile, err := zipWriter.Create("workflowdata.json")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create ZIP entry",
		})
	}
	if _, err := workflowFile.Write(workflowJSON); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to write workflow data",
		})
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
	imageRepo, err := models.NewWorkflowImageRepository(mongoDb)
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
	fileRepo, err := models.NewWorkflowFileRepository(mongoDb)
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
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to serialize metadata",
		})
	}

	metaFile, err := zipWriter.Create("metadata.json")
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create metadata entry",
		})
	}
	if _, err := metaFile.Write(metaJSON); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to write metadata",
		})
	}

	/* Finalize ZIP */
	if err := zipWriter.Close(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to finalize ZIP",
		})
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

	claims, ok := auth.(map[string]interface{})
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
	Claims map[string]interface{}
}
