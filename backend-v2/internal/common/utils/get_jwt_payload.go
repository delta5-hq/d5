package utils

import (
	"encoding/json"
	"fmt"

	"backend-v2/internal/common/constants"
	"backend-v2/internal/common/types"

	"github.com/gofiber/fiber/v2"
)

func GetJwtPayload(c *fiber.Ctx) (*types.JwtPayload, error) {
	raw := c.Locals(constants.ContextAuthKey)
	if raw == nil {
		return nil, fmt.Errorf("auth payload not found in context")
	}

	var auth types.JwtPayload

	bytes, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal auth payload: %w", err)
	}

	if err := json.Unmarshal(bytes, &auth); err != nil {
		return nil, fmt.Errorf("failed to unmarshal auth payload: %w", err)
	}

	return &auth, nil
}
