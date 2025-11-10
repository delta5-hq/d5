package email

/* Service interface for email operations - allows dependency injection */
type Service interface {
	SendSignupNotification(email, username string) error
	SendApprovalNotification(email string) error
	SendResetEmail(email, username, link string) error
	SendRejectionNotification(email string) error
}
