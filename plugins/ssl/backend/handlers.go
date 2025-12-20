package ssl

import (
	"github.com/gin-gonic/gin"
	sdk "github.com/vpanel/sdk"
)

// list returns all certificates
func (p *Plugin) list(c *gin.Context) {
	var params ListCertificatesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		sdk.BadRequest(c, err.Error())
		return
	}

	certs, err := p.service.ListCertificates(&params)
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, certs)
}

// get returns a certificate by ID
func (p *Plugin) get(c *gin.Context) {
	cert, err := p.service.GetCertificate(c.Param("id"))
	if err != nil {
		sdk.NotFound(c, "Certificate not found")
		return
	}
	sdk.Success(c, cert)
}

// lookup finds a certificate by domain
func (p *Plugin) lookup(c *gin.Context) {
	domain := c.Query("domain")
	if domain == "" {
		sdk.BadRequest(c, "domain is required")
		return
	}

	cert, err := p.service.GetCertificateByDomain(domain)
	if err != nil {
		sdk.NotFound(c, "Certificate not found")
		return
	}
	sdk.Success(c, cert)
}

// stats returns SSL certificate statistics
func (p *Plugin) stats(c *gin.Context) {
	stats, err := p.service.GetStats()
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, stats)
}

// createLetsEncrypt creates a Let's Encrypt certificate
func (p *Plugin) createLetsEncrypt(c *gin.Context) {
	var req CreateLetsEncryptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sdk.BadRequest(c, err.Error())
		return
	}

	cert, err := p.service.CreateLetsEncrypt(&req)
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Created(c, cert)
}

// createCustom uploads a custom certificate
func (p *Plugin) createCustom(c *gin.Context) {
	var req CreateCustomCertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sdk.BadRequest(c, err.Error())
		return
	}

	cert, err := p.service.CreateCustom(&req)
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Created(c, cert)
}

// createSelfSigned creates a self-signed certificate
func (p *Plugin) createSelfSigned(c *gin.Context) {
	var req CreateSelfSignedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sdk.BadRequest(c, err.Error())
		return
	}

	cert, err := p.service.CreateSelfSigned(&req)
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Created(c, cert)
}

// update updates a certificate
func (p *Plugin) update(c *gin.Context) {
	var req UpdateCertificateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		sdk.BadRequest(c, err.Error())
		return
	}

	if err := p.service.UpdateCertificate(c.Param("id"), &req); err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, nil)
}

// delete deletes a certificate
func (p *Plugin) delete(c *gin.Context) {
	if err := p.service.DeleteCertificate(c.Param("id")); err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, nil)
}

// renew triggers certificate renewal
func (p *Plugin) renew(c *gin.Context) {
	if err := p.service.RenewCertificate(c.Param("id")); err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, nil)
}

// validate validates a certificate
func (p *Plugin) validate(c *gin.Context) {
	validation, err := p.service.ValidateCertificate(c.Param("id"))
	if err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, validation)
}

// checkExpiring checks for expiring certificates
func (p *Plugin) checkExpiring(c *gin.Context) {
	if err := p.service.CheckExpiringCertificates(); err != nil {
		sdk.InternalError(c, err.Error())
		return
	}
	sdk.Success(c, nil)
}
