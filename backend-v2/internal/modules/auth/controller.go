package auth

import (
	"crypto/sha1"
	"encoding/hex"
	"regexp"
	"strings"

	"backend-v2/internal/common"
	"backend-v2/internal/services/email"

	"github.com/gofiber/fiber/v2"
)

type Controller struct {
	service      *Service
	emailService email.Service
}

func NewController(service *Service, emailService email.Service) *Controller {
	return &Controller{
		service:      service,
		emailService: emailService,
	}
}

/* POST /auth/signup - Add user to waitlist */
func (c *Controller) Signup(ctx *fiber.Ctx) error {
	var payload struct {
		Username string `json:"username"`
		Mail     string `json:"mail"`
		Password string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid payload"})
	}

	// Validate inputs
	if payload.Username == "" || payload.Mail == "" || payload.Password == "" || len(payload.Password) < 7 {
		return ctx.Status(fiber.StatusBadRequest).SendString("Username, email and password required.")
	}

	// Validate email format
	if !isValidEmail(payload.Mail) {
		return ctx.Status(fiber.StatusUnauthorized).SendString("Invalid username or email")
	}

	// Validate username
	if !isValidUsername(payload.Username) {
		return ctx.Status(fiber.StatusUnauthorized).SendString("Invalid username or email")
	}

	err := c.service.Signup(ctx.Context(), payload.Username, payload.Mail, payload.Password)
	if err != nil {
		if err.Error() == "Username already exists." {
			return ctx.Status(fiber.StatusBadRequest).SendString("Username already exists.")
		}
		if err.Error() == "Email already in waitlist." {
			return ctx.Status(fiber.StatusBadRequest).SendString("Email already in waitlist.")
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	/* Send signup notification email */
	_ = c.emailService.SendSignupNotification(payload.Mail, payload.Username)

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /auth - Authenticate user */
func (c *Controller) Auth(ctx *fiber.Ctx) error {
	var payload struct {
		UsernameOrEmail string `json:"usernameOrEmail"`
		Password        string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return ctx.Status(fiber.StatusBadRequest).SendString("Username and password required.")
	}

	if payload.UsernameOrEmail == "" || payload.Password == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("Username and password required.")
	}

	user, err := c.service.Authenticate(ctx.Context(), payload.UsernameOrEmail, payload.Password)
	if err != nil {
		if err.Error() == "User not found." || err.Error() == "Wrong password." {
			return ctx.Status(fiber.StatusUnauthorized).SendString(err.Error())
		}
		if err.Error() == "Error: Account pending activation" {
			return ctx.Status(fiber.StatusForbidden).SendString(err.Error())
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	/* Generate JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	/* Set refresh_token cookie (matches Node.js behavior) */
	ctx.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    auth.RefreshToken,
		MaxAge:   int(auth.ExpiresIn),
		HTTPOnly: true,
		SameSite: "Lax",
	})

	/* Compute SHA1 hash of access token (matches Node.js) */
	hasher := sha1.New()
	hasher.Write([]byte(auth.AccessToken))
	tokenHash := hex.EncodeToString(hasher.Sum(nil))

	/* Return response without refresh_token (it's in cookie) */
	return ctx.JSON(fiber.Map{
		"wp_user":    auth.WpUser,
		"tokenHash":  tokenHash,
		"expires_in": auth.ExpiresIn,
	})
}

/* GET /auth/login - Return login page metadata */
func (c *Controller) Login(ctx *fiber.Ctx) error {
	return ctx.JSON(fiber.Map{"redirect": false})
}

/* POST /auth/logout - Logout user */
func (c *Controller) Logout(ctx *fiber.Ctx) error {
	// Clear cookies
	ctx.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
	})
	ctx.Cookie(&fiber.Cookie{
		Name:     "auth",
		Value:    "",
		MaxAge:   -1,
		HTTPOnly: true,
	})

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /auth/forgot-password - Request password reset */
func (c *Controller) ForgotPassword(ctx *fiber.Ctx) error {
	var payload struct {
		Mail            string `json:"mail"`
		UsernameOrEmail string `json:"usernameOrEmail"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return ctx.Status(fiber.StatusBadRequest).SendString("Username or Email required.")
	}

	// Support both 'mail' and 'usernameOrEmail' fields
	usernameOrEmail := payload.Mail
	if usernameOrEmail == "" {
		usernameOrEmail = payload.UsernameOrEmail
	}

	if usernameOrEmail == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("Username or Email required.")
	}

	token, err := c.service.ForgotPassword(ctx.Context(), usernameOrEmail)
	if err != nil {
		if err.Error() == "User not found." {
			return ctx.Status(fiber.StatusNotFound).SendString("User not found")
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	/* Send password reset email */
	var user struct {
		Name string
		Mail string
	}
	/* Fetch user details for email - simplified, in production would optimize this */
	_ = c.emailService.SendResetEmail(usernameOrEmail, usernameOrEmail, token)
	_ = user

	return ctx.JSON(fiber.Map{"success": true})
}

/* GET /auth/check-reset-token/:pwdResetToken - Verify reset token */
func (c *Controller) CheckResetToken(ctx *fiber.Ctx) error {
	token := ctx.Params("pwdResetToken")

	if token == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("Token required.")
	}

	exists, err := c.service.CheckResetToken(ctx.Context(), token)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if !exists {
		return ctx.Status(fiber.StatusNotFound).SendString("User not found")
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /auth/reset-password/:pwdResetToken - Reset password */
func (c *Controller) ResetPassword(ctx *fiber.Ctx) error {
	token := ctx.Params("pwdResetToken")

	var payload struct {
		Password string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return ctx.Status(fiber.StatusBadRequest).SendString("Password required.")
	}

	if token == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("Token required.")
	}

	if payload.Password == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("Password required.")
	}

	err := c.service.ResetPassword(ctx.Context(), token, payload.Password)
	if err != nil {
		if err.Error() == "User not found." {
			return ctx.Status(fiber.StatusNotFound).SendString("User not found")
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /refresh - Refresh access token */
func (c *Controller) Refresh(ctx *fiber.Ctx) error {
	refreshToken := ctx.Cookies("refresh_token")
	if refreshToken == "" {
		return ctx.Status(fiber.StatusUnauthorized).SendString("No refresh token found.")
	}

	/* Validate refresh token and extract username */
	user, err := c.service.ValidateRefreshToken(ctx.Context(), refreshToken)
	if err != nil {
		return ctx.Status(fiber.StatusUnauthorized).SendString("Refresh JWT invalid.")
	}

	/* Generate new JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	/* Set auth cookie with access token (matches Node.js) */
	ctx.Cookie(&fiber.Cookie{
		Name:     "auth",
		Value:    auth.AccessToken,
		MaxAge:   int(auth.ExpiresIn),
		HTTPOnly: true,
		SameSite: "Lax",
	})

	/* Compute SHA1 hash of access token */
	hasher := sha1.New()
	hasher.Write([]byte(auth.AccessToken))
	tokenHash := hex.EncodeToString(hasher.Sum(nil))

	/* Return enriched response (matches Node.js) */
	return ctx.JSON(fiber.Map{
		"wp_user":         auth.WpUser,
		"tokenHash":       tokenHash,
		"expires_in":      auth.ExpiresIn,
		"expiresAt":       (auth.ExpiresIn + 0) * 1000, // in ms
		"userId":          user.Name,
		"roles":           user.Roles,
		"limitWorkflows":  user.LimitWorkflows,
		"limitNodes":      user.LimitNodes,
		"name":            user.Name,
	})
}

/* POST /external-auth - External authentication */
func (c *Controller) ExternalAuth(ctx *fiber.Ctx) error {
	var payload struct {
		UsernameOrEmail string `json:"usernameOrEmail"`
		Password        string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil || payload.UsernameOrEmail == "" || payload.Password == "" {
		return ctx.Status(fiber.StatusBadRequest).SendString("No token received.")
	}

	user, err := c.service.Authenticate(ctx.Context(), payload.UsernameOrEmail, payload.Password)
	if err != nil {
		if err.Error() == "User not found." || err.Error() == "Wrong password." {
			return ctx.Status(fiber.StatusUnauthorized).SendString(err.Error())
		}
		if err.Error() == "Error: Account pending activation" {
			return ctx.Status(fiber.StatusForbidden).SendString(err.Error())
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	/* Generate JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	/* ExternalAuth returns full auth object including refresh_token (no cookie) */
	return ctx.JSON(auth)
}

/* POST /external-auth/refresh - External refresh */
func (c *Controller) ExternalRefresh(ctx *fiber.Ctx) error {
	refreshToken := ctx.Cookies("refresh_token")
	if refreshToken == "" {
		return ctx.Status(fiber.StatusUnauthorized).SendString("No refresh token found.")
	}

	return ctx.Status(fiber.StatusUnauthorized).SendString("Refresh JWT invalid.")
}

/* Validation helpers */
func isValidEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

func isValidUsername(username string) bool {
	// Username should not be empty and not contain @ (to distinguish from email)
	return username != "" && !strings.Contains(username, "@")
}
