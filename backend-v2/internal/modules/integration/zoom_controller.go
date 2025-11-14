package integration

import (
	"backend-v2/internal/services/zoom"

	"github.com/gofiber/fiber/v2"
)

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2"

type ZoomController struct {
	service zoom.Service
}

func NewZoomController(service zoom.Service) *ZoomController {
	return &ZoomController{
		service: service,
	}
}

func (ctrl *ZoomController) Auth(c *fiber.Ctx) error {
	var body map[string]interface{}
	if err := parseBody(c, &body); err != nil {
		return err
	}

	code, _ := body["code"].(string)
	redirectUri, _ := body["redirect_uri"].(string)

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.Auth(code, redirectUri)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	return c.JSON(result)
}

func (ctrl *ZoomController) Recordings(c *fiber.Ctx) error {
	meetingID := c.Params("id")
	authHeader := c.Get("Authorization")

	if authHeader == "" {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"message": "Zoom Api Key is required",
		})
	}

	/* Extract token from "Bearer <token>" */
	accessToken := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		accessToken = authHeader[7:]
	}

	/* Use injected service (noop or prod) */
	result, err := ctrl.service.GetRecordings(meetingID, accessToken)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": err.Error(),
		})
	}

	/* Extract transcripts from recordings (match Node.js behavior) */
	var transcripts []string
	for _, recording := range result.Recordings {
		if recording.FileType == "TRANSCRIPT" {
			/* Mock transcripts don't have actual VTT processing in noop */
			transcripts = append(transcripts, "Mock transcript: This is a noop zoom recording transcript.")
		}
	}

	return c.JSON(transcripts)
}
