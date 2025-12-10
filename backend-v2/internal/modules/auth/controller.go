package auth

import (
	"crypto/sha1"
	"encoding/hex"
	"log"
	"regexp"
	"strings"

	"backend-v2/internal/common"
	"backend-v2/internal/common/response"
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
		return response.BadRequest(ctx, "Invalid payload")
	}

	// Validate inputs
	if payload.Username == "" || payload.Mail == "" || payload.Password == "" || len(payload.Password) < 7 {
		return response.BadRequest(ctx, "Username, email and password required.")
	}

	// Validate email format
	if !isValidEmail(payload.Mail) {
		return response.Unauthorized(ctx, "Invalid username or email")
	}

	// Validate username
	if !isValidUsername(payload.Username) {
		return response.Unauthorized(ctx, "Invalid username or email")
	}

	err := c.service.Signup(ctx.Context(), payload.Username, payload.Mail, payload.Password)
	if err != nil {
		if err.Error() == "Username already exists." {
			return response.BadRequest(ctx, "Username already exists.")
		}
		if err.Error() == "Email already in waitlist." {
			return response.BadRequest(ctx, "Email already in waitlist.")
		}
		return response.InternalError(ctx, err.Error())
	}

	/* Send signup notification email - non-critical, log failure only */
	if err := c.emailService.SendSignupNotification(payload.Mail, payload.Username); err != nil {
		log.Printf("[WARN] Failed to send signup notification email to %s: %v", payload.Mail, err)
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /auth/login - Cookie-based authentication */
func (c *Controller) Login(ctx *fiber.Ctx) error {
	var payload struct {
		UsernameOrEmail string `json:"usernameOrEmail"`
		Password        string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil {
		return response.BadRequest(ctx, "Username and password required.")
	}

	if payload.UsernameOrEmail == "" || payload.Password == "" {
		return response.BadRequest(ctx, "Username and password required.")
	}

	user, err := c.service.Authenticate(ctx.Context(), payload.UsernameOrEmail, payload.Password)
	if err != nil {
		if err.Error() == "User not found." {
			return response.Unauthorized(ctx, "User not found")
		}
		if err.Error() == "Wrong password." {
			return response.Unauthorized(ctx, "Wrong password")
		}
		if err.Error() == "Error: Account pending activation" {
			return response.Forbidden(ctx, err.Error())
		}
		return response.InternalError(ctx, err.Error())
	}

	/* Generate JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return response.InternalError(ctx, "Failed to generate token")
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
		"user":         auth.User,
		"access_token": auth.AccessToken,
		"tokenHash":    tokenHash,
		"expires_in":   auth.ExpiresIn,
	})
}

/* POST /auth/login-jwt - JWT-based authentication (no cookies) */
func (c *Controller) LoginJWT(ctx *fiber.Ctx) error {
	var payload struct {
		UsernameOrEmail string `json:"usernameOrEmail"`
		Password        string `json:"password"`
	}

	if err := ctx.BodyParser(&payload); err != nil || payload.UsernameOrEmail == "" || payload.Password == "" {
		return response.BadRequest(ctx, "Username and password required.")
	}

	user, err := c.service.Authenticate(ctx.Context(), payload.UsernameOrEmail, payload.Password)
	if err != nil {
		if err.Error() == "User not found." || err.Error() == "Wrong password." {
			return response.Unauthorized(ctx, err.Error())
		}
		if err.Error() == "Error: Account pending activation" {
			return response.Forbidden(ctx, err.Error())
		}
		return response.InternalError(ctx, err.Error())
	}

	/* Generate JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return response.InternalError(ctx, "Failed to generate token")
	}

	/* Return full auth response including refresh_token (no cookies) */
	return ctx.JSON(auth)
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
		return response.BadRequest(ctx, "Username or Email required.")
	}

	// Support both 'mail' and 'usernameOrEmail' fields
	usernameOrEmail := payload.Mail
	if usernameOrEmail == "" {
		usernameOrEmail = payload.UsernameOrEmail
	}

	if usernameOrEmail == "" {
		return response.BadRequest(ctx, "Username or Email required.")
	}

	token, err := c.service.ForgotPassword(ctx.Context(), usernameOrEmail)
	if err != nil {
		if err.Error() == "User not found." {
			return response.NotFound(ctx, "User not found")
		}
		return response.InternalError(ctx, err.Error())
	}

	/* Send password reset email - non-critical, log failure only */
	if err := c.emailService.SendResetEmail(usernameOrEmail, usernameOrEmail, token); err != nil {
		log.Printf("[WARN] Failed to send password reset email to %s: %v", usernameOrEmail, err)
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* GET /auth/check-reset-token/:pwdResetToken - Verify reset token */
func (c *Controller) CheckResetToken(ctx *fiber.Ctx) error {
	token := ctx.Params("pwdResetToken")

	if token == "" {
		return response.BadRequest(ctx, "Token required.")
	}

	exists, err := c.service.CheckResetToken(ctx.Context(), token)
	if err != nil {
		return response.InternalError(ctx, err.Error())
	}

	if !exists {
		return response.NotFound(ctx, "User not found")
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
		return response.BadRequest(ctx, "Password required.")
	}

	if token == "" {
		return response.BadRequest(ctx, "Token required.")
	}

	if payload.Password == "" {
		return response.BadRequest(ctx, "Password required.")
	}

	err := c.service.ResetPassword(ctx.Context(), token, payload.Password)
	if err != nil {
		if err.Error() == "User not found." {
			return response.NotFound(ctx, "User not found")
		}
		return response.InternalError(ctx, err.Error())
	}

	return ctx.JSON(fiber.Map{"success": true})
}

/* POST /refresh - Refresh access token */
func (c *Controller) Refresh(ctx *fiber.Ctx) error {
	refreshToken := ctx.Cookies("refresh_token")
	if refreshToken == "" {
		return response.Unauthorized(ctx, "No refresh token found.")
	}

	/* Validate refresh token and extract username */
	user, err := c.service.ValidateRefreshToken(ctx.Context(), refreshToken)
	if err != nil {
		return response.Unauthorized(ctx, "Refresh JWT invalid.")
	}

	/* Generate new JWT tokens */
	auth, err := common.GenerateAuth(user)
	if err != nil {
		return response.InternalError(ctx, "Failed to generate token")
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

	/* Return enriched response */
	return ctx.JSON(fiber.Map{
		"user":           auth.User,
		"access_token":   auth.AccessToken,
		"tokenHash":      tokenHash,
		"expires_in":     auth.ExpiresIn,
		"expiresAt":      (auth.ExpiresIn + 0) * 1000, // in ms
		"userId":         user.Name,
		"roles":          user.Roles,
		"limitWorkflows": user.LimitWorkflows,
		"limitNodes":     user.LimitNodes,
		"name":           user.Name,
	})
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
