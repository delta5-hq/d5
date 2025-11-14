package types

type JwtPayload struct {
	Sub            string   `json:"sub"`
	Roles          []string `json:"roles"`
	LimitWorkflows int64    `json:"limitWorkflows"`
	LimitNodes     int64    `json:"limitNodes"`
}
