package email

import (
	"crypto/tls"
	"fmt"
	"os"

	"gopkg.in/gomail.v2"
)

type smtpService struct {
	dialer *gomail.Dialer
	from   string
}

/* NewSMTPService creates production email service */
func NewSMTPService() Service {
	host := os.Getenv("MAIL_HOST")
	user := os.Getenv("MAIL_USER")
	pass := os.Getenv("MAIL_PASSWORD")
	port := 465

	if host == "" || user == "" || pass == "" {
		fmt.Println("Warning: Email service not configured (missing MAIL_HOST, MAIL_USER, or MAIL_PASSWORD)")
		return &noopService{}
	}

	dialer := gomail.NewDialer(host, port, user, pass)
	dialer.TLSConfig = &tls.Config{InsecureSkipVerify: true}

	return &smtpService{
		dialer: dialer,
		from:   fmt.Sprintf("Delta 5 <%s>", user),
	}
}

func (s *smtpService) SendSignupNotification(email, username string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "Welcome to Delta 5")
	m.SetBody("text/plain", fmt.Sprintf("Hello %s, welcome to Delta 5!", username))
	m.AddAlternative("text/html", fmt.Sprintf("<p>Hello %s, welcome to Delta 5!</p>", username))

	return s.dialer.DialAndSend(m)
}

func (s *smtpService) SendApprovalNotification(email string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "Your account is approved")
	m.SetBody("text/plain", "Your account has been approved.")
	m.AddAlternative("text/html", "<p>Your account has been approved.</p>")

	return s.dialer.DialAndSend(m)
}

func (s *smtpService) SendResetEmail(email, username, link string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "Password Recovery")
	m.SetBody("text/plain", fmt.Sprintf("Click on the link to recover your account: %s", link))
	m.AddAlternative("text/html", fmt.Sprintf("<!DOCTYPE html><html><body><p>Click on the link to recover your account:</p><br><p>%s</p></body></html>", link))

	return s.dialer.DialAndSend(m)
}

func (s *smtpService) SendRejectionNotification(email string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", s.from)
	m.SetHeader("To", email)
	m.SetHeader("Subject", "Your account has been rejected")
	m.SetBody("text/plain", "We regret to inform you that your account has been rejected.")
	m.AddAlternative("text/html", "<p>We regret to inform you that your account has been rejected.</p>")

	return s.dialer.DialAndSend(m)
}
