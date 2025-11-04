package workflow

type ShareFilters string

const (
	All     ShareFilters = "all"
	Public  ShareFilters = "public"
	Hidden  ShareFilters = "hidden"
	Private ShareFilters = "private"
)

type WorkflowAccess struct {
	IsOwner     bool `json:"isOwner"`
	IsWriteable bool `json:"isWriteable"`
	IsReadable  bool `json:"isReadable"`
}
