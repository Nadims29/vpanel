package services

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/vpanel/server/internal/config"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Auth errors
var (
	ErrUserNotFound      = errors.New("user not found")
	ErrInvalidPassword   = errors.New("invalid password")
	ErrAccountLocked     = errors.New("account is locked")
	ErrAccountInactive   = errors.New("account is inactive")
	ErrInvalidToken      = errors.New("invalid token")
	ErrTokenExpired      = errors.New("token expired")
	ErrMFARequired       = errors.New("mfa code required")
	ErrInvalidMFACode    = errors.New("invalid mfa code")
	ErrUserAlreadyExists = errors.New("user already exists")
)

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// AuthService handles authentication
type AuthService struct {
	db     *gorm.DB
	config *config.Config
	log    *logger.Logger
}

// NewAuthService creates a new auth service
func NewAuthService(db *gorm.DB, cfg *config.Config, log *logger.Logger) *AuthService {
	return &AuthService{db: db, config: cfg, log: log}
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(username, password, mfaCode, ipAddress, userAgent string) (*LoginResult, error) {
	// Find user
	var user models.User
	if err := s.db.Where("username = ? OR email = ?", username, username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			s.recordLoginAttempt(username, ipAddress, false, "user not found")
			return nil, ErrUserNotFound
		}
		return nil, err
	}

	// Check account status
	if user.Status == "locked" {
		s.recordLoginAttempt(username, ipAddress, false, "account locked")
		return nil, ErrAccountLocked
	}
	if user.Status != "active" {
		s.recordLoginAttempt(username, ipAddress, false, "account inactive")
		return nil, ErrAccountInactive
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)); err != nil {
		s.recordLoginAttempt(username, ipAddress, false, "invalid password")
		// Check for too many failed attempts
		s.checkAndLockAccount(user.ID)
		return nil, ErrInvalidPassword
	}

	// Check MFA
	if user.MFAEnabled {
		if mfaCode == "" {
			return nil, ErrMFARequired
		}
		if !s.validateMFACode(user.MFASecret, mfaCode) {
			s.recordLoginAttempt(username, ipAddress, false, "invalid mfa code")
			return nil, ErrInvalidMFACode
		}
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(&user)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.generateRefreshToken(&user)
	if err != nil {
		return nil, err
	}

	// Create session
	session := &models.Session{
		UserID:       user.ID,
		Token:        accessToken,
		RefreshToken: refreshToken,
		IPAddress:    ipAddress,
		UserAgent:    userAgent,
		ExpiresAt:    time.Now().Add(time.Duration(s.config.Auth.RefreshExpiry) * 24 * time.Hour),
	}
	if err := s.db.Create(session).Error; err != nil {
		return nil, err
	}

	// Update last login
	now := time.Now()
	s.db.Model(&user).Updates(map[string]interface{}{
		"last_login_at": &now,
		"last_login_ip": ipAddress,
	})

	// Record successful login
	s.recordLoginAttempt(username, ipAddress, true, "")

	return &LoginResult{
		User:         &user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.config.Auth.TokenExpiry * 60, // seconds
	}, nil
}

// LoginResult contains login response data
type LoginResult struct {
	User         *models.User `json:"user"`
	AccessToken  string       `json:"token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresIn    int          `json:"expires_in"`
}

// Logout invalidates user session
func (s *AuthService) Logout(token string) error {
	return s.db.Where("token = ?", token).Delete(&models.Session{}).Error
}

// RefreshToken refreshes access token
func (s *AuthService) RefreshToken(refreshToken string) (*LoginResult, error) {
	// Find session
	var session models.Session
	if err := s.db.Preload("User").Where("refresh_token = ?", refreshToken).First(&session).Error; err != nil {
		return nil, ErrInvalidToken
	}

	// Check expiry
	if session.ExpiresAt.Before(time.Now()) {
		s.db.Delete(&session)
		return nil, ErrTokenExpired
	}

	// Generate new tokens
	accessToken, err := s.generateAccessToken(&session.User)
	if err != nil {
		return nil, err
	}

	newRefreshToken, err := s.generateRefreshToken(&session.User)
	if err != nil {
		return nil, err
	}

	// Update session
	session.Token = accessToken
	session.RefreshToken = newRefreshToken
	session.ExpiresAt = time.Now().Add(time.Duration(s.config.Auth.RefreshExpiry) * 24 * time.Hour)
	s.db.Save(&session)

	return &LoginResult{
		User:         &session.User,
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    s.config.Auth.TokenExpiry * 60,
	}, nil
}

// ValidateToken validates a JWT token and returns the claims
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	claims := &JWTClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.getJWTSecret()), nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}

// GetUserByID returns user by ID
func (s *AuthService) GetUserByID(userID string) (*models.User, error) {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// Register creates a new user
func (s *AuthService) Register(username, email, password, displayName string) (*models.User, error) {
	// Check if user exists
	var count int64
	s.db.Model(&models.User{}).Where("username = ? OR email = ?", username, email).Count(&count)
	if count > 0 {
		return nil, ErrUserAlreadyExists
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Username:    username,
		Email:       email,
		Password:    string(hashedPassword),
		DisplayName: displayName,
		Role:        "user",
		Status:      "active",
	}

	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

// ChangePassword changes user password
func (s *AuthService) ChangePassword(userID, oldPassword, newPassword string) error {
	var user models.User
	if err := s.db.First(&user, "id = ?", userID).Error; err != nil {
		return err
	}

	// Verify old password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return ErrInvalidPassword
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.db.Model(&user).Update("password", string(hashedPassword)).Error
}

// UpdateProfile updates user profile
func (s *AuthService) UpdateProfile(userID string, updates map[string]interface{}) (*models.User, error) {
	// Only allow certain fields to be updated
	allowed := map[string]bool{
		"display_name": true,
		"email":        true,
		"avatar":       true,
		"preferences":  true,
	}

	filtered := make(map[string]interface{})
	for k, v := range updates {
		if allowed[k] {
			filtered[k] = v
		}
	}

	if err := s.db.Model(&models.User{}).Where("id = ?", userID).Updates(filtered).Error; err != nil {
		return nil, err
	}

	return s.GetUserByID(userID)
}

// Helper methods

func (s *AuthService) generateAccessToken(user *models.User) (string, error) {
	claims := JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.config.Auth.TokenExpiry) * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "vpanel",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.getJWTSecret()))
}

func (s *AuthService) generateRefreshToken(user *models.User) (string, error) {
	claims := JWTClaims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.config.Auth.RefreshExpiry) * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "vpanel-refresh",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.getJWTSecret()))
}

func (s *AuthService) getJWTSecret() string {
	if s.config.Auth.JWTSecret != "" {
		return s.config.Auth.JWTSecret
	}
	return "vpanel-default-secret-change-me"
}

func (s *AuthService) recordLoginAttempt(username, ipAddress string, success bool, reason string) {
	attempt := &models.LoginAttempt{
		Username:  username,
		IPAddress: ipAddress,
		Success:   success,
		Reason:    reason,
	}
	s.db.Create(attempt)
}

func (s *AuthService) checkAndLockAccount(userID string) {
	var count int64
	since := time.Now().Add(-time.Duration(s.config.Auth.LockoutDuration) * time.Minute)

	s.db.Model(&models.LoginAttempt{}).
		Where("username = ? AND success = ? AND created_at > ?", userID, false, since).
		Count(&count)

	if count >= int64(s.config.Auth.MaxLoginAttempts) {
		s.db.Model(&models.User{}).Where("id = ?", userID).Update("status", "locked")
		s.log.Warn("Account locked due to too many failed login attempts", "user_id", userID)
	}
}

func (s *AuthService) validateMFACode(secret, code string) bool {
	// TODO: Implement TOTP validation
	// For now, just return true if code matches secret (demo purposes)
	return code == secret
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword checks if password matches hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
