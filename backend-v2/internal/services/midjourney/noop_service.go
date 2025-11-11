package midjourney

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) Create(prompt string, params map[string]interface{}) (*CreateResponse, error) {
	return &CreateResponse{
		TaskId:   "mock-task-id-12345",
		Status:   "completed",
		Prompt:   prompt,
		ImageURL: "https://example.com/mock-midjourney-image.png",
	}, nil
}

func (s *noopService) Upscale(taskId string, index int) (*UpscaleResponse, error) {
	return &UpscaleResponse{
		TaskId:   taskId,
		Status:   "completed",
		ImageURL: "https://example.com/mock-midjourney-upscaled.png",
	}, nil
}
