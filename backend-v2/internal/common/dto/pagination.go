package dto

type PaginationDto struct {
	Search *string `json:"search,omitempty"`
	Page   *int    `json:"page,omitempty"`
	Limit  *int    `json:"limit,omitempty"`
}

func (p PaginationDto) GetPage () int {
	if (p.Page == nil) {
		return 1
	}
	return *p.Page
}

func (p PaginationDto) GetLimit () int {
	if (p.Limit == nil) {
		return 10
	}
	return *p.Limit
}

func (p PaginationDto) GetSearch () string {
	if (p.Search == nil) {
		return  ""
	}
	return  *p.Search
}