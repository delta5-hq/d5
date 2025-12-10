package common

import (
	"backend-v2/internal/config"
	"backend-v2/internal/models"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type AuthResponse struct {
	User         UserInfo `json:"user"`
	AccessToken  string   `json:"access_token"`
	ExpiresIn    int64    `json:"expires_in"`
	RefreshToken string   `json:"refresh_token"`
	TokenHash    string   `json:"tokenHash,omitempty"`
}

type UserInfo struct {
	ID    string       `json:"id"`
	Roles []string     `json:"roles"`
	Data  UserInfoData `json:"data"`
}

type UserInfoData struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
}

/* GenerateAuth creates JWT tokens and auth response */
func GenerateAuth(user *models.User) (*AuthResponse, error) {
	expiresIn := int64(86400) // 24 hours

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
		User: UserInfo{
			ID:    user.Name,
			Roles: user.Roles,
			Data: UserInfoData{
				ID:          user.Name,
				DisplayName: user.Name,
				Email:       user.Mail,
			},
		},
		AccessToken:  tokenString,
		ExpiresIn:    expiresIn,
		RefreshToken: tokenString,
	}, nil
}
