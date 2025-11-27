package workflow

import (
	"backend-v2/internal/common/dto"
	"backend-v2/internal/common/types"
	"backend-v2/internal/models"
)

type CreateWorkflowDto struct {
	UserID string
	Auth   *types.JwtPayload
	Share  *models.Share
}

func (d CreateWorkflowDto) GetLimit() int64 {
	if d.Auth == nil {
		return 0
	}
	return d.Auth.LimitWorkflows
}

type GetWorkflowsQuery struct {
	dto.PaginationDto
	UserID      string
	IsPublic    bool
	ShareFilter ShareFilters
}
