package integration

import (
	"backend-v2/internal/services/yandex"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/qiniu/qmgo"
)

/* YandexController handles Yandex AI-specific endpoints */
type YandexController struct {
	service yandex.Service
	db      *qmgo.Database
}

func NewYandexController(service yandex.Service, db *qmgo.Database) *YandexController {
	return &YandexController{service: service, db: db}
}

/* YandexCompletionRequest holds Yandex completion API request data */
type YandexCompletionRequest struct {
	Messages []yandex.Message `json:"messages"`
	Model    string           `json:"model"`
}

func (r *YandexCompletionRequest) Validate() error {
	if len(r.Messages) == 0 {
		return fmt.Errorf("Messages are required")
	}
	return nil
}

/* YandexEmbeddingsRequest holds Yandex embeddings API request data */
type YandexEmbeddingsRequest struct {
	Text     string `json:"text"`
	ModelUri string `json:"modelUri"`
}

func (r *YandexEmbeddingsRequest) Validate() error {
	if r.Text == "" {
		return fmt.Errorf("Text is required")
	}
	if r.ModelUri == "" {
		return fmt.Errorf("ModelUri is required")
	}
	return nil
}

/* Completion handles Yandex completion API */
func (ctrl *YandexController) Completion(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req YandexCompletionRequest
	if err := parseBody(c, &req); err != nil {
		return err
	}

	if err := req.Validate(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	result, err := ctrl.service.Completion(ctrl.db, userID, req.Messages, req.Model, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}

/* Embeddings handles Yandex embeddings API */
func (ctrl *YandexController) Embeddings(c *fiber.Ctx) error {
	userID, err := getUserID(c)
	if err != nil {
		return err
	}

	var req YandexEmbeddingsRequest
	if err := parseBody(c, &req); err != nil {
		return err
	}

	if err := req.Validate(); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	result, err := ctrl.service.Embeddings(ctrl.db, userID, req.Text, req.ModelUri)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}
