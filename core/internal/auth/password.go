package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

// Password policy errors
var (
	ErrPasswordTooShort      = errors.New("password must be at least 8 characters")
	ErrPasswordTooLong       = errors.New("password must be at most 128 characters")
	ErrPasswordNoUppercase   = errors.New("password must contain at least one uppercase letter")
	ErrPasswordNoLowercase   = errors.New("password must contain at least one lowercase letter")
	ErrPasswordNoDigit       = errors.New("password must contain at least one digit")
	ErrPasswordNoSpecial     = errors.New("password must contain at least one special character")
	ErrPasswordCommonPattern = errors.New("password contains common patterns")
	ErrPasswordRecentlyUsed  = errors.New("password was recently used")
	ErrPasswordContainsUser  = errors.New("password cannot contain username or email")
)

// PasswordPolicy defines password requirements
type PasswordPolicy struct {
	MinLength        int  `json:"min_length"`
	MaxLength        int  `json:"max_length"`
	RequireUppercase bool `json:"require_uppercase"`
	RequireLowercase bool `json:"require_lowercase"`
	RequireDigit     bool `json:"require_digit"`
	RequireSpecial   bool `json:"require_special"`
	PreventCommon    bool `json:"prevent_common"`
	HistoryCount     int  `json:"history_count"`     // Number of previous passwords to check
	MaxAge           int  `json:"max_age"`           // Days until password expires (0 = never)
	PreventUserInfo  bool `json:"prevent_user_info"` // Prevent password containing username/email
}

// DefaultPasswordPolicy returns the default password policy
func DefaultPasswordPolicy() *PasswordPolicy {
	return &PasswordPolicy{
		MinLength:        8,
		MaxLength:        128,
		RequireUppercase: true,
		RequireLowercase: true,
		RequireDigit:     true,
		RequireSpecial:   false,
		PreventCommon:    true,
		HistoryCount:     5,
		MaxAge:           0,
		PreventUserInfo:  true,
	}
}

// ValidatePassword validates a password against the policy
func (p *PasswordPolicy) ValidatePassword(password string, username, email string, history []string) error {
	if len(password) < p.MinLength {
		return ErrPasswordTooShort
	}
	if len(password) > p.MaxLength {
		return ErrPasswordTooLong
	}

	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if p.RequireUppercase && !hasUpper {
		return ErrPasswordNoUppercase
	}
	if p.RequireLowercase && !hasLower {
		return ErrPasswordNoLowercase
	}
	if p.RequireDigit && !hasDigit {
		return ErrPasswordNoDigit
	}
	if p.RequireSpecial && !hasSpecial {
		return ErrPasswordNoSpecial
	}

	if p.PreventCommon && isCommonPassword(password) {
		return ErrPasswordCommonPattern
	}

	if p.PreventUserInfo {
		lowerPassword := strings.ToLower(password)
		if username != "" && strings.Contains(lowerPassword, strings.ToLower(username)) {
			return ErrPasswordContainsUser
		}
		if email != "" {
			emailParts := strings.Split(email, "@")
			if len(emailParts) > 0 && strings.Contains(lowerPassword, strings.ToLower(emailParts[0])) {
				return ErrPasswordContainsUser
			}
		}
	}

	// Check password history
	if p.HistoryCount > 0 && len(history) > 0 {
		checkCount := p.HistoryCount
		if checkCount > len(history) {
			checkCount = len(history)
		}
		for i := 0; i < checkCount; i++ {
			if CheckPassword(password, history[i]) {
				return ErrPasswordRecentlyUsed
			}
		}
	}

	return nil
}

// Common passwords list (abbreviated, production would have a larger list)
var commonPasswords = map[string]bool{
	"password":    true,
	"123456":      true,
	"12345678":    true,
	"qwerty":      true,
	"abc123":      true,
	"monkey":      true,
	"1234567":     true,
	"letmein":     true,
	"trustno1":    true,
	"dragon":      true,
	"baseball":    true,
	"iloveyou":    true,
	"master":      true,
	"sunshine":    true,
	"ashley":      true,
	"bailey":      true,
	"shadow":      true,
	"123123":      true,
	"654321":      true,
	"superman":    true,
	"qazwsx":      true,
	"michael":     true,
	"football":    true,
	"password1":   true,
	"password123": true,
	"welcome":     true,
	"welcome1":    true,
	"admin":       true,
	"admin123":    true,
	"root":        true,
	"toor":        true,
	"pass":        true,
	"test":        true,
	"guest":       true,
	"changeme":    true,
	"111111":      true,
	"000000":      true,
	"1234567890":  true,
	"password!":   true,
	"passw0rd":    true,
}

// Common patterns to check
var commonPatterns = []*regexp.Regexp{
	regexp.MustCompile(`^(012|123|234|345|456|567|678|789|890)+$`), // Sequential numbers
	regexp.MustCompile(`^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$`), // Sequential letters
	regexp.MustCompile(`^(qwerty|asdf|zxcv)+`), // Keyboard patterns
}

// isAllSameChar checks if password is all same character
func isAllSameChar(s string) bool {
	if len(s) == 0 {
		return false
	}
	first := s[0]
	for i := 1; i < len(s); i++ {
		if s[i] != first {
			return false
		}
	}
	return true
}

func isCommonPassword(password string) bool {
	lower := strings.ToLower(password)

	if commonPasswords[lower] {
		return true
	}

	// Check for all same character pattern
	if isAllSameChar(lower) {
		return true
	}

	// Check for common patterns
	for _, pattern := range commonPatterns {
		if pattern.MatchString(lower) {
			return true
		}
	}

	return false
}

// HashPassword hashes a password using bcrypt with adaptive cost
func HashPassword(password string) (string, error) {
	// Use cost of 12 for production (balance between security and performance)
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(bytes), err
}

// CheckPassword checks if password matches hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateRandomPassword generates a cryptographically secure random password
func GenerateRandomPassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}
	if length > 128 {
		length = 128
	}

	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"

	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	for i := range bytes {
		bytes[i] = charset[bytes[i]%byte(len(charset))]
	}

	return string(bytes), nil
}

// GenerateSecureToken generates a cryptographically secure random token
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// GenerateRecoveryCodes generates MFA recovery codes
func GenerateRecoveryCodes(count int) ([]string, error) {
	codes := make([]string, count)
	for i := 0; i < count; i++ {
		bytes := make([]byte, 5)
		if _, err := rand.Read(bytes); err != nil {
			return nil, err
		}
		// Format as XXXXX-XXXXX
		code := strings.ToUpper(base64.RawURLEncoding.EncodeToString(bytes))[:10]
		codes[i] = code[:5] + "-" + code[5:]
	}
	return codes, nil
}

// GenerateAPIKey generates a new API key
func GenerateAPIKey() (key, prefix string, err error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", err
	}

	key = base64.URLEncoding.EncodeToString(bytes)
	prefix = key[:8]

	return key, prefix, nil
}
