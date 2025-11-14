package common

import (
	"backend-v2/internal/config"
	"backend-v2/internal/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AuthResponse struct {
	WpUser       WpUser `json:"wp_user"`
	AccessToken  string `json:"access_token"`
	ExpiresIn    int64  `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	TokenHash    string `json:"tokenHash,omitempty"`
}

type WpUser struct {
	ID    string   `json:"ID"`
	Roles []string `json:"roles"`
	Data  WpUserData `json:"data"`
}

type WpUserData struct {
	ID          string `json:"ID"`
	DisplayName string `json:"display_name"`
	UserEmail   string `json:"user_email"`
}

/* GenerateAuth creates JWT tokens and auth response matching Node.js implementation */
func GenerateAuth(user *models.User) (*AuthResponse, error) {
	expiresIn := int64(86400) // 24 hours (JWT_TTL from Node.js)
	
	claims := jwt.MapClaims{
		"sub":            user.Name,
		"roles":          user.Roles,
		"limitWorkflows": user.LimitWorkflows,
		"limitNodes":     user.LimitNodes,
		"exp":            time.Now().Add(time.Duration(expiresIn) * time.Second).Unix(),
		"iat":            time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.JwtSecret))
	if err != nil {
		return nil, err
	}

	return &AuthResponse{
		WpUser: WpUser{
			ID:    user.Name,
			Roles: user.Roles,
			Data: WpUserData{
				ID:          user.Name,
				DisplayName: user.Name,
				UserEmail:   user.Mail,
			},
		},
		AccessToken:  tokenString,
		ExpiresIn:    expiresIn,
		RefreshToken: tokenString,
	}, nil
}
