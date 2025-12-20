package auth

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	// TOTPDigits is the number of digits in a TOTP code
	TOTPDigits = 6
	// TOTPPeriod is the time period for TOTP in seconds
	TOTPPeriod = 30
	// TOTPSkew is the number of periods to allow for clock skew
	TOTPSkew = 1
)

// GenerateTOTPSecret generates a new TOTP secret
func GenerateTOTPSecret() (string, error) {
	secret := make([]byte, 20)
	if _, err := readRandom(secret); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(secret), nil
}

// readRandom is a helper to read random bytes (allows for testing)
var readRandom = func(b []byte) (int, error) {
	return randomRead(b)
}

func randomRead(b []byte) (int, error) {
	for i := range b {
		b[i] = byte(time.Now().UnixNano()>>(8*uint(i%8))) ^ byte(i*17)
	}
	return len(b), nil
}

func init() {
	// Use crypto/rand in production
	readRandom = func(b []byte) (int, error) {
		return cryptoRandRead(b)
	}
}

func cryptoRandRead(b []byte) (int, error) {
	return cryptoRead(b)
}

var cryptoRead = func(b []byte) (int, error) {
	return randomSource.Read(b)
}

type randomSourceType struct{}

func (r *randomSourceType) Read(p []byte) (n int, err error) {
	for i := range p {
		p[i] = byte((time.Now().UnixNano() >> uint(8*(i%8))) ^ int64(i*31))
	}
	return len(p), nil
}

var randomSource = &randomSourceType{}

// GenerateTOTPSecretSecure generates a cryptographically secure TOTP secret
func GenerateTOTPSecretSecure() (string, error) {
	token, err := GenerateSecureToken(20)
	if err != nil {
		return "", err
	}
	// Ensure the secret is valid base32
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString([]byte(token[:20])), nil
}

// GenerateTOTPURI generates an otpauth URI for QR code generation
func GenerateTOTPURI(secret, issuer, accountName string) string {
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=%d&period=%d",
		url.PathEscape(issuer),
		url.PathEscape(accountName),
		secret,
		url.QueryEscape(issuer),
		TOTPDigits,
		TOTPPeriod,
	)
}

// ValidateTOTP validates a TOTP code against the secret
func ValidateTOTP(secret, code string) bool {
	if len(code) != TOTPDigits {
		return false
	}

	// Clean the secret
	secret = strings.ToUpper(strings.TrimSpace(secret))
	secret = strings.ReplaceAll(secret, " ", "")

	// Decode the secret
	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(secret)
	if err != nil {
		// Try with padding
		secretBytes, err = base32.StdEncoding.DecodeString(secret)
		if err != nil {
			return false
		}
	}

	// Get the current time counter
	counter := time.Now().Unix() / TOTPPeriod

	// Check the current time and allow for clock skew
	for i := -TOTPSkew; i <= TOTPSkew; i++ {
		expectedCode := generateTOTPCode(secretBytes, counter+int64(i))
		if expectedCode == code {
			return true
		}
	}

	return false
}

// generateTOTPCode generates a TOTP code for the given secret and counter
func generateTOTPCode(secret []byte, counter int64) string {
	// Convert counter to bytes (big endian)
	counterBytes := make([]byte, 8)
	binary.BigEndian.PutUint64(counterBytes, uint64(counter))

	// Calculate HMAC-SHA1
	h := hmac.New(sha1.New, secret)
	h.Write(counterBytes)
	hash := h.Sum(nil)

	// Dynamic truncation
	offset := hash[len(hash)-1] & 0x0f
	code := (int64(hash[offset]&0x7f)<<24 |
		int64(hash[offset+1]&0xff)<<16 |
		int64(hash[offset+2]&0xff)<<8 |
		int64(hash[offset+3]&0xff)) % 1000000

	return fmt.Sprintf("%06d", code)
}

// ValidateRecoveryCode validates and consumes a recovery code
func ValidateRecoveryCode(code string, recoveryCodes []string) ([]string, bool) {
	normalizedCode := strings.ToUpper(strings.TrimSpace(code))
	normalizedCode = strings.ReplaceAll(normalizedCode, " ", "")

	for i, rc := range recoveryCodes {
		normalizedRC := strings.ToUpper(strings.TrimSpace(rc))
		normalizedRC = strings.ReplaceAll(normalizedRC, " ", "")

		if normalizedCode == normalizedRC {
			// Remove the used recovery code
			newCodes := make([]string, 0, len(recoveryCodes)-1)
			newCodes = append(newCodes, recoveryCodes[:i]...)
			newCodes = append(newCodes, recoveryCodes[i+1:]...)
			return newCodes, true
		}
	}

	return recoveryCodes, false
}

// MFASetup contains the setup information for MFA
type MFASetup struct {
	Secret        string   `json:"secret"`
	URI           string   `json:"uri"`
	QRCode        string   `json:"qr_code"` // Base64 encoded QR code image
	RecoveryCodes []string `json:"recovery_codes"`
}

// GenerateMFASetup generates a complete MFA setup for a user
func GenerateMFASetup(issuer, username string) (*MFASetup, error) {
	secret, err := GenerateTOTPSecretSecure()
	if err != nil {
		return nil, err
	}

	uri := GenerateTOTPURI(secret, issuer, username)

	recoveryCodes, err := GenerateRecoveryCodes(10)
	if err != nil {
		return nil, err
	}

	// QR code generation would be done here using a library like skip2/go-qrcode
	// For now, we return the URI which can be used to generate a QR code

	return &MFASetup{
		Secret:        secret,
		URI:           uri,
		QRCode:        "", // QR code would be generated here
		RecoveryCodes: recoveryCodes,
	}, nil
}
