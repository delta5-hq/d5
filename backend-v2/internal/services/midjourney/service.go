package midjourney

type Service interface {
	Create(prompt string, params map[string]interface{}) (*CreateResponse, error)
	Upscale(taskId string, index int) (*UpscaleResponse, error)
}

type CreateResponse struct {
	TaskId   string `json:"task_id"`
	Status   string `json:"status"`
	Prompt   string `json:"prompt"`
	ImageURL string `json:"image_url,omitempty"`
}

type UpscaleResponse struct {
	TaskId   string `json:"task_id"`
	Status   string `json:"status"`
	ImageURL string `json:"image_url,omitempty"`
}
