package license

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/vpanel/core/pkg/response"
)

// Handlers provides HTTP handlers for license management
type Handlers struct {
	svc *Service
}

// NewHandlers creates new license handlers
func NewHandlers(svc *Service) *Handlers {
	return &Handlers{svc: svc}
}

// GetLicenseInfo returns the current license information
// @Summary Get license info
// @Description Get current license information
// @Tags license
// @Produce json
// @Success 200 {object} LicenseInfo
// @Router /license [get]
func (h *Handlers) GetLicenseInfo(c *gin.Context) {
	info, err := h.svc.GetLicenseInfo()
	if err != nil {
		response.InternalError(c, "Failed to get license info")
		return
	}

	response.Success(c, info)
}

// ActivateLicense activates a license key
// @Summary Activate license
// @Description Activate a Pro license using a license key
// @Tags license
// @Accept json
// @Produce json
// @Param request body ActivateLicenseRequest true "License key"
// @Success 200 {object} LicenseInfo
// @Failure 400 {object} response.Response
// @Router /license/activate [post]
func (h *Handlers) ActivateLicense(c *gin.Context) {
	var req ActivateLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	info, err := h.svc.ActivateLicense(req.LicenseKey)
	if err != nil {
		switch {
		case errors.Is(err, ErrAlreadyActivated):
			response.Error(c, http.StatusConflict, "ALREADY_ACTIVATED", "A license is already activated. Please deactivate it first.")
		case errors.Is(err, ErrLicenseInvalid):
			response.BadRequest(c, err.Error())
		case errors.Is(err, ErrValidationFailed):
			response.Error(c, http.StatusServiceUnavailable, "VALIDATION_FAILED", err.Error())
		default:
			response.InternalError(c, "Failed to activate license")
		}
		return
	}

	response.Success(c, info)
}

// DeactivateLicense deactivates the current license
// @Summary Deactivate license
// @Description Deactivate the current Pro license
// @Tags license
// @Produce json
// @Success 200 {object} response.Response
// @Router /license/deactivate [post]
func (h *Handlers) DeactivateLicense(c *gin.Context) {
	err := h.svc.DeactivateLicense()
	if err != nil {
		if errors.Is(err, ErrLicenseNotFound) {
			response.NotFound(c, "No active license found")
			return
		}
		response.InternalError(c, "Failed to deactivate license")
		return
	}

	response.Success(c, gin.H{"message": "License deactivated successfully"})
}

// RefreshLicense refreshes the license with the cloud server
// @Summary Refresh license
// @Description Force refresh license validation with the cloud server
// @Tags license
// @Produce json
// @Success 200 {object} LicenseInfo
// @Router /license/refresh [post]
func (h *Handlers) RefreshLicense(c *gin.Context) {
	info, err := h.svc.RefreshLicense()
	if err != nil {
		switch {
		case errors.Is(err, ErrLicenseNotFound):
			response.NotFound(c, "No active license found")
		case errors.Is(err, ErrLicenseRevoked):
			response.Error(c, http.StatusForbidden, "LICENSE_REVOKED", "License has been revoked")
		case errors.Is(err, ErrValidationFailed):
			response.Error(c, http.StatusServiceUnavailable, "VALIDATION_FAILED", err.Error())
		default:
			response.InternalError(c, "Failed to refresh license")
		}
		return
	}

	response.Success(c, info)
}

// CheckProFeature middleware checks if Pro features are available
func (h *Handlers) CheckProFeature() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !h.svc.IsPro() {
			response.Error(c, http.StatusPaymentRequired, "PRO_REQUIRED", "This feature requires a Pro license. Visit https://vcloud.zsoft.cc to upgrade.")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CheckEnterpriseFeature middleware checks if Enterprise features are available
func (h *Handlers) CheckEnterpriseFeature() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !h.svc.IsEnterprise() {
			response.Error(c, http.StatusPaymentRequired, "ENTERPRISE_REQUIRED", "This feature requires an Enterprise license. Visit https://vcloud.zsoft.cc to upgrade.")
			c.Abort()
			return
		}
		c.Next()
	}
}

// CheckFeature middleware checks if a specific feature is enabled
func (h *Handlers) CheckFeature(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !h.svc.HasFeature(feature) {
			response.Error(c, http.StatusPaymentRequired, "FEATURE_REQUIRED", "This feature requires a Pro license with the '"+feature+"' feature enabled.")
			c.Abort()
			return
		}
		c.Next()
	}
}
