package auth

import (
	"backend-v2/internal/config"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/qiniu/qmgo"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"

	"backend-v2/internal/models"
)

type Service struct {
	usersCollection    *qmgo.Collection
	waitlistCollection *qmgo.Collection
}

func NewService(usersCollection, waitlistCollection *qmgo.Collection) *Service {
	return &Service{
		usersCollection:    usersCollection,
		waitlistCollection: waitlistCollection,
	}
}

/* Signup - Add user to waitlist */
func (s *Service) Signup(ctx context.Context, username, email, password string) error {
	// Sanitize inputs
	username = strings.TrimSpace(strings.ToLower(username))
	email = strings.TrimSpace(strings.ToLower(email))

	// Check if user exists
	userFilter := bson.M{"$or": []bson.M{
		{"name": username},
		{"mail": email},
		{"mail": username},
	}}

	userCount, err := s.usersCollection.Find(ctx, userFilter).Count()
	if err == nil && userCount > 0 {
		return ErrUserExists
	}

	// Check if already in waitlist
	waitlistCount, err := s.waitlistCollection.Find(ctx, userFilter).Count()
	if err == nil && waitlistCount > 0 {
		return ErrWaitlistExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	if err != nil {
		return err
	}

	now := time.Now()
	waitlist := models.Waitlist{
		ID:        primitive.NewObjectID(),
		UserID:    username,
		Name:      username,
		Mail:      email,
		Password:  string(hashedPassword),
		Meta:      make(map[string]interface{}),
		Status:    "pending",
		CreatedAt: now,
		UpdatedAt: now,
	}

	_, err = s.waitlistCollection.InsertOne(ctx, waitlist)
	return err
}

/* Authenticate user */
func (s *Service) Authenticate(ctx context.Context, usernameOrEmail, password string) (*models.User, error) {
	usernameOrEmail = strings.TrimSpace(strings.ToLower(usernameOrEmail))

	filter := bson.M{"$or": []bson.M{
		{"name": usernameOrEmail},
		{"mail": usernameOrEmail},
	}}

	var user models.User
	err := s.usersCollection.Find(ctx, filter).One(&user)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
	if err != nil {
		return nil, ErrInvalidPassword
	}

	// Check if confirmed
	if !user.Confirmed {
		return nil, ErrAccountPending
	}

	return &user, nil
}

/* ForgotPassword - Generate reset token */
func (s *Service) ForgotPassword(ctx context.Context, usernameOrEmail string) (string, error) {
	usernameOrEmail = strings.TrimSpace(strings.ToLower(usernameOrEmail))

	filter := bson.M{"$or": []bson.M{
		{"name": usernameOrEmail},
		{"mail": usernameOrEmail},
	}}

	var user models.User
	err := s.usersCollection.Find(ctx, filter).One(&user)
	if err != nil {
		return "", ErrUserNotFound
	}

	// Generate random token
	token, err := generateRandomString(100)
	if err != nil {
		return "", fmt.Errorf("failed to generate reset token: %w", err)
	}

	// Update user with reset token
	update := bson.M{"$set": bson.M{"pwdResetToken": token}}
	filter = bson.M{"id": user.ID}
	err = s.usersCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return "", err
	}

	return token, nil
}

/* CheckResetToken - Verify reset token exists */
func (s *Service) CheckResetToken(ctx context.Context, token string) (bool, error) {
	filter := bson.M{"pwdResetToken": token}
	count, err := s.usersCollection.Find(ctx, filter).Count()
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

/* ResetPassword - Update password using reset token */
func (s *Service) ResetPassword(ctx context.Context, token, newPassword string) error {
	filter := bson.M{"pwdResetToken": token}

	var user models.User
	err := s.usersCollection.Find(ctx, filter).One(&user)
	if err != nil {
		return ErrUserNotFound
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), 10)
	if err != nil {
		return err
	}

	// Update password and clear reset token
	update := bson.M{
		"$set": bson.M{
			"password":  string(hashedPassword),
			"updatedAt": time.Now(),
		},
		"$unset": bson.M{"pwdResetToken": ""},
	}

	filter = bson.M{"id": user.ID}
	err = s.usersCollection.UpdateOne(ctx, filter, update)
	return err
}

/* ValidateRefreshToken - Validate JWT refresh token and return user */
func (s *Service) ValidateRefreshToken(ctx context.Context, tokenString string) (*models.User, error) {
	/* Parse and validate JWT token */
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		/* Enforce HS256 algorithm */
		if t.Method.Alg() != "HS256" {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(config.JwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	/* Extract claims */
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	/* Get username from subject */
	sub, ok := claims["sub"].(string)
	if !ok || sub == "" {
		return nil, errors.New("invalid token subject")
	}

	/* Find user by username */
	filter := bson.M{"name": sub}
	var user models.User
	err = s.usersCollection.Find(ctx, filter).One(&user)
	if err != nil {
		return nil, ErrUserNotFound
	}

	return &user, nil
}

func generateRandomString(length int) (string, error) {
	bytes := make([]byte, length/2)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("crypto/rand.Read failed: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

/* Custom errors */
var (
	ErrUserExists      = &AuthError{Message: "Username already exists."}
	ErrWaitlistExists  = &AuthError{Message: "Email already in waitlist."}
	ErrUserNotFound    = &AuthError{Message: "User not found."}
	ErrInvalidPassword = &AuthError{Message: "Wrong password."}
	ErrAccountPending  = &AuthError{Message: "Error: Account pending activation"}
)

type AuthError struct {
	Message string
}

func (e *AuthError) Error() string {
	return e.Message
}
