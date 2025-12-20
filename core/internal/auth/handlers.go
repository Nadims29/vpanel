package auth

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/core/pkg/response"
)

// Handlers provides HTTP handlers for authentication
type Handlers struct {
	svc *Service
}

// NewHandlers creates new auth handlers
func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

// Login handles user login
// @Summary User login
// @Description Authenticate user and return tokens
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login credentials"
// @Success 200 {object} LoginResult
// @Failure 401 {object} response.Response
// @Failure 403 {object} response.Response
// @Router /auth/login [post]
func (h *Handlers) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	result, err := h.svc.Login(&req, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		switch err {
		case ErrUserNotFound, ErrInvalidPassword:
			response.Unauthorized(c, "Invalid username or password")
		case ErrAccountLocked:
			response.Forbidden(c, "Account is locked. Please try again later or contact support.")
		case ErrAccountInactive:
			response.Forbidden(c, "Account is inactive. Please contact support.")
		case ErrMFARequired:
			c.JSON(http.StatusOK, gin.H{
				"success":      false,
				"mfa_required": true,
				"message":      "MFA verification required",
			})
		case ErrInvalidMFACode:
			response.Unauthorized(c, "Invalid MFA code")
		case ErrPasswordExpired:
			response.Error(c, http.StatusForbidden, "PASSWORD_EXPIRED", "Password has expired. Please reset your password.")
		case ErrIPBlacklisted:
			response.Forbidden(c, "Access denied from this IP address")
		default:
			response.InternalError(c, "Login failed")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"user":          result.User,
		"token":         result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    result.ExpiresIn,
		"session_id":    result.SessionID,
	})
}

// Register handles user registration
// @Summary User registration
// @Description Create a new user account
// @Tags auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Registration data"
// @Success 201 {object} SafeUser
// @Failure 400 {object} response.Response
// @Failure 409 {object} response.Response
// @Router /auth/register [post]
func (h *Handlers) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.svc.Register(&req)
	if err != nil {
		switch err {
		case ErrUserAlreadyExists:
			response.Conflict(c, "Username or email already exists")
		case ErrPasswordTooShort, ErrPasswordTooLong, ErrPasswordNoUppercase,
			ErrPasswordNoLowercase, ErrPasswordNoDigit, ErrPasswordNoSpecial,
			ErrPasswordCommonPattern, ErrPasswordContainsUser:
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, "Registration failed")
		}
		return
	}

	response.Created(c, user.ToSafe())
}

// RefreshToken handles token refresh
// @Summary Refresh access token
// @Description Get a new access token using refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body object{refresh_token=string} true "Refresh token"
// @Success 200 {object} LoginResult
// @Failure 401 {object} response.Response
// @Router /auth/refresh [post]
func (h *Handlers) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	result, err := h.svc.RefreshToken(req.RefreshToken)
	if err != nil {
		switch err {
		case ErrInvalidToken, ErrSessionNotFound:
			response.Unauthorized(c, "Invalid refresh token")
		case ErrSessionExpired, ErrTokenExpired:
			response.Unauthorized(c, "Session expired. Please login again.")
		case ErrAccountInactive:
			response.Forbidden(c, "Account is inactive")
		default:
			response.InternalError(c, "Token refresh failed")
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"token":         result.AccessToken,
		"refresh_token": result.RefreshToken,
		"expires_in":    result.ExpiresIn,
	})
}

// Profile returns the current user's profile
// @Summary Get user profile
// @Description Get the current user's profile information
// @Tags profile
// @Produce json
// @Security BearerAuth
// @Success 200 {object} SafeUser
// @Failure 401 {object} response.Response
// @Router /profile [get]
func (h *Handlers) Profile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	user, err := h.svc.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}

	response.Success(c, user.ToSafe())
}

// UpdateProfile updates the current user's profile
// @Summary Update user profile
// @Description Update the current user's profile information
// @Tags profile
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateProfileRequest true "Profile updates"
// @Success 200 {object} SafeUser
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /profile [put]
func (h *Handlers) UpdateProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	var req UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.svc.UpdateProfile(userID, &req)
	if err != nil {
		if err == ErrUserAlreadyExists {
			response.Conflict(c, "Email already in use")
			return
		}
		response.InternalError(c, "Failed to update profile")
		return
	}

	response.Success(c, user.ToSafe())
}

// Logout handles user logout
// @Summary User logout
// @Description Invalidate the current session
// @Tags auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /auth/logout [post]
func (h *Handlers) Logout(c *gin.Context) {
	userID := c.GetString("user_id")
	token := c.GetHeader("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	if userID != "" && token != "" {
		h.svc.Logout(token, userID)
	}

	response.Success(c, gin.H{"message": "Logged out successfully"})
}

// LogoutAll logs out all sessions
// @Summary Logout all sessions
// @Description Invalidate all user sessions except current
// @Tags auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /auth/logout/all [post]
func (h *Handlers) LogoutAll(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.GetString("session_id")

	if err := h.svc.LogoutAllSessions(userID, sessionID); err != nil {
		response.InternalError(c, "Failed to logout all sessions")
		return
	}

	response.Success(c, gin.H{"message": "All other sessions have been logged out"})
}

// GetSessions returns active sessions
// @Summary Get active sessions
// @Description Get list of active sessions for the current user
// @Tags session
// @Produce json
// @Security BearerAuth
// @Success 200 {array} SessionInfo
// @Router /sessions [get]
func (h *Handlers) GetSessions(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.GetString("session_id")

	sessions, err := h.svc.GetActiveSessions(userID, sessionID)
	if err != nil {
		response.InternalError(c, "Failed to get sessions")
		return
	}

	response.Success(c, sessions)
}

// RevokeSession revokes a specific session
// @Summary Revoke session
// @Description Revoke a specific session by ID
// @Tags session
// @Produce json
// @Security BearerAuth
// @Param id path string true "Session ID"
// @Success 200 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /sessions/{id} [delete]
func (h *Handlers) RevokeSession(c *gin.Context) {
	userID := c.GetString("user_id")
	sessionID := c.Param("id")

	if err := h.svc.RevokeSession(userID, sessionID); err != nil {
		if err == ErrSessionNotFound {
			response.NotFound(c, "Session not found")
			return
		}
		response.InternalError(c, "Failed to revoke session")
		return
	}

	response.Success(c, gin.H{"message": "Session revoked successfully"})
}

// ChangePassword handles password change
// @Summary Change password
// @Description Change the current user's password
// @Tags profile
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ChangePasswordRequest true "Password change data"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /profile/password [post]
func (h *Handlers) ChangePassword(c *gin.Context) {
	userID := c.GetString("user_id")

	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.svc.ChangePassword(userID, &req, c.ClientIP(), c.Request.UserAgent()); err != nil {
		switch err {
		case ErrInvalidPassword:
			response.Unauthorized(c, "Current password is incorrect")
		case ErrPasswordTooShort, ErrPasswordTooLong, ErrPasswordNoUppercase,
			ErrPasswordNoLowercase, ErrPasswordNoDigit, ErrPasswordNoSpecial,
			ErrPasswordCommonPattern, ErrPasswordRecentlyUsed, ErrPasswordContainsUser:
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, "Failed to change password")
		}
		return
	}

	response.Success(c, gin.H{"message": "Password changed successfully"})
}

// SetupMFA initiates MFA setup
// @Summary Setup MFA
// @Description Initialize or complete MFA setup
// @Tags mfa
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{code=string} false "TOTP code to verify setup"
// @Success 200 {object} MFASetupResponse
// @Failure 400 {object} response.Response
// @Router /profile/mfa/setup [post]
func (h *Handlers) SetupMFA(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Code string `json:"code"`
	}
	c.ShouldBindJSON(&req)

	result, err := h.svc.EnableMFA(userID, req.Code)
	if err != nil {
		switch err {
		case ErrMFAAlreadyEnabled:
			response.Conflict(c, "MFA is already enabled")
		case ErrInvalidMFACode:
			response.BadRequest(c, "Invalid verification code")
		default:
			response.InternalError(c, "Failed to setup MFA")
		}
		return
	}

	response.Success(c, result)
}

// DisableMFA disables MFA
// @Summary Disable MFA
// @Description Disable MFA for the current user
// @Tags mfa
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{password=string} true "Password confirmation"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /profile/mfa [delete]
func (h *Handlers) DisableMFA(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Password is required")
		return
	}

	if err := h.svc.DisableMFA(userID, req.Password); err != nil {
		switch err {
		case ErrMFANotEnabled:
			response.BadRequest(c, "MFA is not enabled")
		case ErrInvalidPassword:
			response.Unauthorized(c, "Invalid password")
		default:
			response.InternalError(c, "Failed to disable MFA")
		}
		return
	}

	response.Success(c, gin.H{"message": "MFA disabled successfully"})
}

// RegenerateMFACodes regenerates recovery codes
// @Summary Regenerate recovery codes
// @Description Generate new MFA recovery codes
// @Tags mfa
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{password=string} true "Password confirmation"
// @Success 200 {object} object{recovery_codes=[]string}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /profile/mfa/recovery [post]
func (h *Handlers) RegenerateMFACodes(c *gin.Context) {
	userID := c.GetString("user_id")

	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Password is required")
		return
	}

	codes, err := h.svc.RegenerateRecoveryCodes(userID, req.Password)
	if err != nil {
		switch err {
		case ErrMFANotEnabled:
			response.BadRequest(c, "MFA is not enabled")
		case ErrInvalidPassword:
			response.Unauthorized(c, "Invalid password")
		default:
			response.InternalError(c, "Failed to regenerate recovery codes")
		}
		return
	}

	response.Success(c, gin.H{"recovery_codes": codes})
}

// CreateAPIKey creates a new API key
// @Summary Create API key
// @Description Create a new API key for programmatic access
// @Tags apikey
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateAPIKeyRequest true "API key details"
// @Success 201 {object} CreateAPIKeyResponse
// @Failure 400 {object} response.Response
// @Router /profile/api-keys [post]
func (h *Handlers) CreateAPIKey(c *gin.Context) {
	userID := c.GetString("user_id")

	var req CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	result, err := h.svc.CreateAPIKey(userID, &req)
	if err != nil {
		response.InternalError(c, "Failed to create API key")
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":    true,
		"api_key":    result.APIKey,
		"secret_key": result.SecretKey,
		"message":    "Save this secret key - it won't be shown again",
	})
}

// GetAPIKeys lists API keys
// @Summary List API keys
// @Description Get all API keys for the current user
// @Tags apikey
// @Produce json
// @Security BearerAuth
// @Success 200 {array} APIKey
// @Router /profile/api-keys [get]
func (h *Handlers) GetAPIKeys(c *gin.Context) {
	userID := c.GetString("user_id")

	keys, err := h.svc.GetAPIKeys(userID)
	if err != nil {
		response.InternalError(c, "Failed to get API keys")
		return
	}

	response.Success(c, keys)
}

// DeleteAPIKey deletes an API key
// @Summary Delete API key
// @Description Delete an API key by ID
// @Tags apikey
// @Produce json
// @Security BearerAuth
// @Param id path string true "API key ID"
// @Success 200 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /profile/api-keys/{id} [delete]
func (h *Handlers) DeleteAPIKey(c *gin.Context) {
	userID := c.GetString("user_id")
	keyID := c.Param("id")

	if err := h.svc.DeleteAPIKey(userID, keyID); err != nil {
		if err == ErrAPIKeyNotFound {
			response.NotFound(c, "API key not found")
			return
		}
		response.InternalError(c, "Failed to delete API key")
		return
	}

	response.Success(c, gin.H{"message": "API key deleted successfully"})
}

// RequestPasswordReset handles password reset request
// @Summary Request password reset
// @Description Send a password reset email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body object{email=string} true "User email"
// @Success 200 {object} response.Response
// @Router /auth/password/reset [post]
func (h *Handlers) RequestPasswordReset(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Valid email is required")
		return
	}

	// Always return success to prevent email enumeration
	h.svc.RequestPasswordReset(req.Email, c.ClientIP())

	response.Success(c, gin.H{
		"message": "If an account exists with this email, a password reset link has been sent",
	})
}

// ResetPassword handles password reset
// @Summary Reset password
// @Description Reset password using a reset token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body object{token=string,password=string} true "Reset data"
// @Success 200 {object} response.Response
// @Failure 400 {object} response.Response
// @Router /auth/password/reset/confirm [post]
func (h *Handlers) ResetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token" binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if err := h.svc.ResetPassword(req.Token, req.Password); err != nil {
		switch err {
		case ErrInvalidToken, ErrTokenExpired:
			response.BadRequest(c, "Invalid or expired reset token")
		case ErrPasswordTooShort, ErrPasswordTooLong, ErrPasswordNoUppercase,
			ErrPasswordNoLowercase, ErrPasswordNoDigit, ErrPasswordNoSpecial,
			ErrPasswordCommonPattern, ErrPasswordRecentlyUsed:
			response.BadRequest(c, err.Error())
		default:
			response.InternalError(c, "Failed to reset password")
		}
		return
	}

	response.Success(c, gin.H{"message": "Password reset successfully. Please login with your new password."})
}

// Admin handlers

// AdminListUsers lists all users (admin only)
// @Summary List users
// @Description Get paginated list of all users
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param search query string false "Search term"
// @Param role query string false "Filter by role"
// @Param status query string false "Filter by status"
// @Success 200 {object} response.Response
// @Router /admin/users [get]
func (h *Handlers) AdminListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	search := c.Query("search")
	role := c.Query("role")
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	users, total, err := h.svc.ListUsers(page, perPage, search, role, status)
	if err != nil {
		response.InternalError(c, "Failed to list users")
		return
	}

	// Convert to safe users
	safeUsers := make([]*SafeUser, len(users))
	for i, u := range users {
		safeUsers[i] = u.ToSafe()
	}

	response.Paginated(c, safeUsers, total, page, perPage)
}

// AdminGetUser gets a user by ID (admin only)
// @Summary Get user
// @Description Get user details by ID
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} SafeUser
// @Failure 404 {object} response.Response
// @Router /admin/users/{id} [get]
func (h *Handlers) AdminGetUser(c *gin.Context) {
	userID := c.Param("id")

	user, err := h.svc.GetUserByID(userID)
	if err != nil {
		response.NotFound(c, "User not found")
		return
	}

	response.Success(c, user.ToSafe())
}

// AdminUpdateUser updates a user (admin only)
// @Summary Update user
// @Description Update user details
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body object true "User updates"
// @Success 200 {object} SafeUser
// @Failure 404 {object} response.Response
// @Router /admin/users/{id} [put]
func (h *Handlers) AdminUpdateUser(c *gin.Context) {
	adminID := c.GetString("user_id")
	userID := c.Param("id")

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	user, err := h.svc.AdminUpdateUser(adminID, userID, updates)
	if err != nil {
		if err == ErrUserNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to update user")
		return
	}

	response.Success(c, user.ToSafe())
}

// AdminDeleteUser deletes a user (admin only)
// @Summary Delete user
// @Description Delete a user by ID
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /admin/users/{id} [delete]
func (h *Handlers) AdminDeleteUser(c *gin.Context) {
	adminID := c.GetString("user_id")
	userID := c.Param("id")

	if adminID == userID {
		response.BadRequest(c, "Cannot delete your own account")
		return
	}

	if err := h.svc.AdminDeleteUser(adminID, userID); err != nil {
		if err == ErrUserNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to delete user")
		return
	}

	response.Success(c, gin.H{"message": "User deleted successfully"})
}

// AdminCreateUserRequest represents the request to create a user
type AdminCreateUserRequest struct {
	Username    string `json:"username" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
}

// AdminCreateUser creates a new user (admin only)
// @Summary Create user
// @Description Create a new user
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body AdminCreateUserRequest true "User details"
// @Success 200 {object} SafeUser
// @Failure 400 {object} response.Response
// @Router /admin/users [post]
func (h *Handlers) AdminCreateUser(c *gin.Context) {
	var req AdminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Use the Register functionality
	registerReq := &RegisterRequest{
		Username:    req.Username,
		Email:       req.Email,
		Password:    req.Password,
		DisplayName: req.DisplayName,
	}

	user, err := h.svc.Register(registerReq)
	if err != nil {
		if err == ErrUserAlreadyExists {
			response.BadRequest(c, "User already exists")
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	// Update role if specified
	if req.Role != "" && req.Role != string(RoleUser) {
		user.Role = req.Role
		if err := h.svc.db.Save(user).Error; err != nil {
			response.InternalError(c, "Failed to update user role")
			return
		}
	}

	response.Success(c, user.ToSafe())
}

// AdminResetUserPassword resets a user's password (admin only)
// @Summary Reset user password
// @Description Reset a user's password
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body object{password=string} true "New password"
// @Success 200 {object} response.Response
// @Router /admin/users/{id}/password [put]
func (h *Handlers) AdminResetUserPassword(c *gin.Context) {
	userID := c.Param("id")
	var req struct {
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.svc.AdminResetPassword(userID, req.Password); err != nil {
		if err == ErrUserNotFound {
			response.NotFound(c, "User not found")
			return
		}
		response.InternalError(c, "Failed to reset password")
		return
	}

	response.Success(c, gin.H{"message": "Password reset successfully"})
}

// AdminEnableUserMFA enables MFA for a user (admin only)
// @Summary Enable user MFA
// @Description Enable MFA for a user and return setup info
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} response.Response
// @Router /admin/users/{id}/mfa/enable [post]
func (h *Handlers) AdminEnableUserMFA(c *gin.Context) {
	userID := c.Param("id")

	var user User
	if err := h.svc.db.First(&user, "id = ?", userID).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	// Generate MFA setup
	setup, err := GenerateMFASetup("VPanel", user.Username)
	if err != nil {
		response.InternalError(c, "Failed to generate MFA setup")
		return
	}

	// Update user
	user.MFAEnabled = true
	user.MFASecret = setup.Secret
	user.MFARecoveryCodes = setup.RecoveryCodes
	if err := h.svc.db.Save(&user).Error; err != nil {
		response.InternalError(c, "Failed to enable MFA")
		return
	}

	response.Success(c, gin.H{
		"secret":       setup.Secret,
		"qr_code":      setup.URI,
		"backup_codes": setup.RecoveryCodes,
	})
}

// AdminDisableUserMFA disables MFA for a user (admin only)
// @Summary Disable user MFA
// @Description Disable MFA for a user
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} response.Response
// @Router /admin/users/{id}/mfa/disable [post]
func (h *Handlers) AdminDisableUserMFA(c *gin.Context) {
	userID := c.Param("id")

	var user User
	if err := h.svc.db.First(&user, "id = ?", userID).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	user.MFAEnabled = false
	user.MFASecret = ""
	user.MFARecoveryCodes = nil
	if err := h.svc.db.Save(&user).Error; err != nil {
		response.InternalError(c, "Failed to disable MFA")
		return
	}

	response.Success(c, gin.H{"message": "MFA disabled successfully"})
}

// AdminResetUserMFA resets MFA for a user (admin only)
// @Summary Reset user MFA
// @Description Reset MFA for a user and return new setup info
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Success 200 {object} response.Response
// @Router /admin/users/{id}/mfa/reset [post]
func (h *Handlers) AdminResetUserMFA(c *gin.Context) {
	userID := c.Param("id")

	var user User
	if err := h.svc.db.First(&user, "id = ?", userID).Error; err != nil {
		response.NotFound(c, "User not found")
		return
	}

	// Generate new MFA setup
	setup, err := GenerateMFASetup("VPanel", user.Username)
	if err != nil {
		response.InternalError(c, "Failed to generate MFA setup")
		return
	}

	// Update user
	user.MFAEnabled = true
	user.MFASecret = setup.Secret
	user.MFARecoveryCodes = setup.RecoveryCodes
	if err := h.svc.db.Save(&user).Error; err != nil {
		response.InternalError(c, "Failed to reset MFA")
		return
	}

	response.Success(c, gin.H{
		"secret":       setup.Secret,
		"qr_code":      setup.URI,
		"backup_codes": setup.RecoveryCodes,
	})
}

// AdminGetAuditLogs gets audit logs (admin only)
// @Summary Get audit logs
// @Description Get paginated audit logs
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Param user_id query string false "Filter by user ID"
// @Param action query string false "Filter by action"
// @Param resource query string false "Filter by resource"
// @Param start_time query string false "Filter by start time (RFC3339)"
// @Param end_time query string false "Filter by end time (RFC3339)"
// @Success 200 {object} response.Response
// @Router /admin/audit-logs [get]
func (h *Handlers) AdminGetAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	userID := c.Query("user_id")
	action := c.Query("action")
	resource := c.Query("resource")

	var startTime, endTime *time.Time
	if st := c.Query("start_time"); st != "" {
		if t, err := time.Parse(time.RFC3339, st); err == nil {
			startTime = &t
		}
	}
	if et := c.Query("end_time"); et != "" {
		if t, err := time.Parse(time.RFC3339, et); err == nil {
			endTime = &t
		}
	}

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	logs, total, err := h.svc.GetAuditLogs(userID, action, resource, startTime, endTime, page, perPage)
	if err != nil {
		response.InternalError(c, "Failed to get audit logs")
		return
	}

	response.Paginated(c, logs, total, page, perPage)
}

// AdminGetAuditStats gets audit log statistics (admin only)
// @Summary Get audit log statistics
// @Description Get audit log statistics
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /admin/audit-logs/stats [get]
func (h *Handlers) AdminGetAuditStats(c *gin.Context) {
	stats, err := h.svc.GetAuditStats()
	if err != nil {
		response.InternalError(c, "Failed to get audit stats")
		return
	}
	response.Success(c, stats)
}

// AdminGetAuditActions gets distinct audit actions (admin only)
// @Summary Get audit actions
// @Description Get list of distinct audit actions
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /admin/audit-logs/actions [get]
func (h *Handlers) AdminGetAuditActions(c *gin.Context) {
	actions, err := h.svc.GetAuditActions()
	if err != nil {
		response.InternalError(c, "Failed to get audit actions")
		return
	}
	response.Success(c, actions)
}

// AdminGetAuditResources gets distinct audit resources (admin only)
// @Summary Get audit resources
// @Description Get list of distinct audit resources
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /admin/audit-logs/resources [get]
func (h *Handlers) AdminGetAuditResources(c *gin.Context) {
	resources, err := h.svc.GetAuditResources()
	if err != nil {
		response.InternalError(c, "Failed to get audit resources")
		return
	}
	response.Success(c, resources)
}

// GetPasswordPolicy returns the current password policy
// @Summary Get password policy
// @Description Get the current password policy requirements
// @Tags auth
// @Produce json
// @Success 200 {object} PasswordPolicy
// @Router /auth/password-policy [get]
func (h *Handlers) GetPasswordPolicy(c *gin.Context) {
	response.Success(c, h.svc.GetPasswordPolicy())
}

// GetSystemSettings retrieves all system settings
// @Summary Get system settings
// @Description Get all system settings grouped by category
// @Tags settings
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /settings [get]
func (h *Handlers) GetSystemSettings(c *gin.Context) {
	settings, err := h.svc.GetSystemSettings()
	if err != nil {
		response.InternalError(c, "Failed to load settings")
		return
	}
	response.Success(c, settings)
}

// UpdateSystemSettings updates system settings
// @Summary Update system settings
// @Description Update system settings
// @Tags settings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object true "Settings updates"
// @Success 200 {object} response.Response
// @Router /settings [put]
func (h *Handlers) UpdateSystemSettings(c *gin.Context) {
	userID := c.GetString("user_id")

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.BadRequest(c, "Invalid request")
		return
	}

	if err := h.svc.UpdateSystemSettings(userID, updates); err != nil {
		response.InternalError(c, "Failed to update settings")
		return
	}

	response.Success(c, gin.H{"message": "Settings updated successfully"})
}

// RegisterRoutes registers auth routes
func (h *Handlers) RegisterRoutes(public, protected, admin *gin.RouterGroup) {
	// Public routes (no auth required)
	public.POST("/auth/login", h.Login)
	public.POST("/auth/register", h.Register)
	public.POST("/auth/refresh", h.RefreshToken)
	public.POST("/auth/password/reset", h.RequestPasswordReset)
	public.POST("/auth/password/reset/confirm", h.ResetPassword)
	public.GET("/auth/password-policy", h.GetPasswordPolicy)

	// Protected routes (auth required)
	protected.GET("/profile", h.Profile)
	protected.PUT("/profile", h.UpdateProfile)
	protected.POST("/profile/password", h.ChangePassword)
	protected.POST("/auth/logout", h.Logout)
	protected.POST("/auth/logout/all", h.LogoutAll)

	// Session management
	protected.GET("/sessions", h.GetSessions)
	protected.DELETE("/sessions/:id", h.RevokeSession)

	// MFA
	protected.POST("/profile/mfa/setup", h.SetupMFA)
	protected.DELETE("/profile/mfa", h.DisableMFA)
	protected.POST("/profile/mfa/recovery", h.RegenerateMFACodes)

	// API Keys
	protected.GET("/profile/api-keys", h.GetAPIKeys)
	protected.POST("/profile/api-keys", h.CreateAPIKey)
	protected.DELETE("/profile/api-keys/:id", h.DeleteAPIKey)

	// Get user's effective permissions (for frontend)
	protected.GET("/profile/permissions", h.GetMyPermissions)

	// Admin routes
	if admin != nil {
		// User management - more specific routes first
		admin.GET("/users", h.AdminListUsers)
		admin.POST("/users", h.AdminCreateUser)
		admin.PUT("/users/:id/password", h.AdminResetUserPassword)
		admin.POST("/users/:id/mfa/enable", h.AdminEnableUserMFA)
		admin.POST("/users/:id/mfa/disable", h.AdminDisableUserMFA)
		admin.POST("/users/:id/mfa/reset", h.AdminResetUserMFA)
		admin.PUT("/users/:id/role", h.AdminAssignUserRole)
		admin.GET("/users/:id", h.AdminGetUser)
		admin.PUT("/users/:id", h.AdminUpdateUser)
		admin.DELETE("/users/:id", h.AdminDeleteUser)

		// Role management
		admin.GET("/roles", h.AdminListRoles)
		admin.POST("/roles", h.AdminCreateRole)
		admin.GET("/roles/:id", h.AdminGetRole)
		admin.PUT("/roles/:id", h.AdminUpdateRole)
		admin.DELETE("/roles/:id", h.AdminDeleteRole)
		admin.GET("/roles/:id/users", h.AdminGetRoleUsers)

		// Permission management
		admin.GET("/permissions", h.AdminListPermissions)

		// Audit logs
		admin.GET("/audit-logs", h.AdminGetAuditLogs)
		admin.GET("/audit-logs/stats", h.AdminGetAuditStats)
		admin.GET("/audit-logs/actions", h.AdminGetAuditActions)
		admin.GET("/audit-logs/resources", h.AdminGetAuditResources)
	}
}

// ============================================
// Role Management Handlers
// ============================================

// AdminListRoles lists all roles
// @Summary List roles
// @Description Get all roles in the system
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} Role
// @Router /admin/roles [get]
func (h *Handlers) AdminListRoles(c *gin.Context) {
	roles, err := h.svc.ListRoles()
	if err != nil {
		response.InternalError(c, "Failed to list roles")
		return
	}

	// Add user count to each role
	type RoleWithCount struct {
		Role
		UserCount int64 `json:"user_count"`
	}

	rolesWithCount := make([]RoleWithCount, len(roles))
	for i, role := range roles {
		var count int64
		h.svc.db.Model(&User{}).Where("role = ?", role.Name).Count(&count)
		rolesWithCount[i] = RoleWithCount{
			Role:      role,
			UserCount: count,
		}
	}

	response.Success(c, rolesWithCount)
}

// AdminGetRole gets a role by ID
// @Summary Get role
// @Description Get role details by ID
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "Role ID"
// @Success 200 {object} Role
// @Failure 404 {object} response.Response
// @Router /admin/roles/{id} [get]
func (h *Handlers) AdminGetRole(c *gin.Context) {
	roleID := c.Param("id")

	role, err := h.svc.GetRole(roleID)
	if err != nil {
		if err == ErrRoleNotFound {
			response.NotFound(c, "Role not found")
			return
		}
		response.InternalError(c, "Failed to get role")
		return
	}

	response.Success(c, role)
}

// AdminCreateRole creates a new role
// @Summary Create role
// @Description Create a new custom role
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateRoleRequest true "Role data"
// @Success 201 {object} Role
// @Failure 400 {object} response.Response
// @Router /admin/roles [post]
func (h *Handlers) AdminCreateRole(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	role, err := h.svc.CreateRole(&req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, role)
}

// AdminUpdateRole updates a role
// @Summary Update role
// @Description Update role details
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Role ID"
// @Param request body UpdateRoleRequest true "Role updates"
// @Success 200 {object} Role
// @Failure 404 {object} response.Response
// @Router /admin/roles/{id} [put]
func (h *Handlers) AdminUpdateRole(c *gin.Context) {
	roleID := c.Param("id")

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	role, err := h.svc.UpdateRole(roleID, &req)
	if err != nil {
		switch err {
		case ErrRoleNotFound:
			response.NotFound(c, "Role not found")
		case ErrSystemRoleModify:
			response.Forbidden(c, "System roles cannot be modified")
		default:
			response.InternalError(c, "Failed to update role")
		}
		return
	}

	response.Success(c, role)
}

// AdminDeleteRole deletes a role
// @Summary Delete role
// @Description Delete a custom role
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "Role ID"
// @Success 200 {object} response.Response
// @Failure 404 {object} response.Response
// @Router /admin/roles/{id} [delete]
func (h *Handlers) AdminDeleteRole(c *gin.Context) {
	roleID := c.Param("id")

	err := h.svc.DeleteRole(roleID)
	if err != nil {
		switch err {
		case ErrRoleNotFound:
			response.NotFound(c, "Role not found")
		case ErrSystemRoleModify:
			response.Forbidden(c, "System roles cannot be deleted")
		case ErrRoleInUse:
			response.BadRequest(c, "Role is in use by users and cannot be deleted")
		default:
			response.InternalError(c, "Failed to delete role")
		}
		return
	}

	response.Success(c, gin.H{"message": "Role deleted successfully"})
}

// AdminGetRoleUsers gets users with a specific role
// @Summary Get role users
// @Description Get users assigned to a specific role
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path string true "Role ID"
// @Param page query int false "Page number" default(1)
// @Param per_page query int false "Items per page" default(20)
// @Success 200 {object} response.Response
// @Router /admin/roles/{id}/users [get]
func (h *Handlers) AdminGetRoleUsers(c *gin.Context) {
	roleID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))

	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	// Get role first to get the name
	role, err := h.svc.GetRole(roleID)
	if err != nil {
		if err == ErrRoleNotFound {
			response.NotFound(c, "Role not found")
			return
		}
		response.InternalError(c, "Failed to get role")
		return
	}

	users, total, err := h.svc.GetRoleUsers(role.Name, page, perPage)
	if err != nil {
		response.InternalError(c, "Failed to get role users")
		return
	}

	// Convert to safe users
	safeUsers := make([]*SafeUser, len(users))
	for i, u := range users {
		safeUsers[i] = u.ToSafe()
	}

	response.Paginated(c, safeUsers, total, page, perPage)
}

// AdminAssignUserRole assigns a role to a user
// @Summary Assign user role
// @Description Assign a role to a user
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "User ID"
// @Param request body object{role=string} true "Role name"
// @Success 200 {object} response.Response
// @Router /admin/users/{id}/role [put]
func (h *Handlers) AdminAssignUserRole(c *gin.Context) {
	adminID := c.GetString("user_id")
	userID := c.Param("id")

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Role is required")
		return
	}

	if err := h.svc.AssignUserRole(userID, req.Role, adminID); err != nil {
		switch err {
		case ErrUserNotFound:
			response.NotFound(c, "User not found")
		case ErrRoleNotFound:
			response.BadRequest(c, "Role not found")
		default:
			response.InternalError(c, "Failed to assign role")
		}
		return
	}

	response.Success(c, gin.H{"message": "Role assigned successfully"})
}

// AdminListPermissions lists all permissions
// @Summary List permissions
// @Description Get all available permissions
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /admin/permissions [get]
func (h *Handlers) AdminListPermissions(c *gin.Context) {
	grouped := c.Query("grouped") == "true"

	if grouped {
		permissions, err := h.svc.GetPermissionsByCategory()
		if err != nil {
			response.InternalError(c, "Failed to get permissions")
			return
		}
		response.Success(c, permissions)
	} else {
		permissions, err := h.svc.ListPermissions()
		if err != nil {
			response.InternalError(c, "Failed to get permissions")
			return
		}
		response.Success(c, permissions)
	}
}

// GetMyPermissions returns the current user's effective permissions
// @Summary Get my permissions
// @Description Get the current user's effective permissions
// @Tags profile
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /profile/permissions [get]
func (h *Handlers) GetMyPermissions(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	permissions, err := h.svc.GetUserEffectivePermissions(userID)
	if err != nil {
		response.InternalError(c, "Failed to get permissions")
		return
	}

	response.Success(c, gin.H{
		"permissions": permissions,
	})
}
