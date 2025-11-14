package email

/* noopService implements Service interface with no-op methods for E2E testing */
type noopService struct{}

/* NewNoopService creates service that performs no operations - for E2E testing */
func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) SendSignupNotification(email, username string) error {
	return nil
}

func (s *noopService) SendApprovalNotification(email string) error {
	return nil
}

func (s *noopService) SendResetEmail(email, username, link string) error {
	return nil
}

func (s *noopService) SendRejectionNotification(email string) error {
	return nil
}
