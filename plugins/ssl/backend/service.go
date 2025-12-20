package ssl

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"

	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Service handles SSL certificate operations
type Service struct {
	db      *gorm.DB
	logger  sdk.Logger
	dataDir string
}

// NewService creates a new SSL service
func NewService(db *gorm.DB, logger sdk.Logger, dataDir string) *Service {
	return &Service{
		db:      db,
		logger:  logger,
		dataDir: dataDir,
	}
}

// ensureCertDir ensures the certificate directory exists
func (s *Service) ensureCertDir() string {
	certDir := filepath.Join(s.dataDir, "certs")
	os.MkdirAll(certDir, 0700)
	return certDir
}

// ListCertificates returns all certificates matching the query
func (s *Service) ListCertificates(params *ListCertificatesParams) ([]SSLCertificate, error) {
	var certs []SSLCertificate
	query := s.db.Model(&SSLCertificate{})

	if params != nil {
		if params.Status != "" {
			query = query.Where("status = ?", params.Status)
		}
		if params.Type != "" {
			query = query.Where("type = ?", params.Type)
		}
		if params.Domain != "" {
			query = query.Where("domain LIKE ?", "%"+params.Domain+"%")
		}
		if params.NodeID != "" {
			query = query.Where("node_id = ?", params.NodeID)
		}
	}

	err := query.Order("created_at DESC").Find(&certs).Error
	if err != nil {
		return nil, err
	}

	// Update status for each certificate
	for i := range certs {
		certs[i].UpdateStatus()
	}

	return certs, nil
}

// GetCertificate returns a certificate by ID
func (s *Service) GetCertificate(id string) (*SSLCertificate, error) {
	var cert SSLCertificate
	if err := s.db.First(&cert, "id = ?", id).Error; err != nil {
		return nil, err
	}
	cert.UpdateStatus()
	return &cert, nil
}

// GetCertificateByDomain returns a certificate by domain
func (s *Service) GetCertificateByDomain(domain string) (*SSLCertificate, error) {
	var cert SSLCertificate
	err := s.db.Where("domain = ? OR domains LIKE ?", domain, "%"+domain+"%").
		Order("created_at DESC").
		First(&cert).Error
	if err != nil {
		return nil, err
	}
	cert.UpdateStatus()
	return &cert, nil
}

// GetStats returns SSL certificate statistics
func (s *Service) GetStats() (*SSLStats, error) {
	var stats SSLStats
	var count int64

	// Count total
	s.db.Model(&SSLCertificate{}).Where("deleted_at IS NULL").Count(&count)
	stats.Total = int(count)
	
	// Count by status
	s.db.Model(&SSLCertificate{}).Where("status = ? AND deleted_at IS NULL", CertStatusActive).Count(&count)
	stats.Active = int(count)
	s.db.Model(&SSLCertificate{}).Where("status = ? AND deleted_at IS NULL", CertStatusExpiring).Count(&count)
	stats.Expiring = int(count)
	s.db.Model(&SSLCertificate{}).Where("status = ? AND deleted_at IS NULL", CertStatusExpired).Count(&count)
	stats.Expired = int(count)

	// Count by type
	s.db.Model(&SSLCertificate{}).Where("type = ? AND deleted_at IS NULL", CertTypeLetsEncrypt).Count(&count)
	stats.LetsEncrypt = int(count)
	s.db.Model(&SSLCertificate{}).Where("type = ? AND deleted_at IS NULL", CertTypeCustom).Count(&count)
	stats.Custom = int(count)
	s.db.Model(&SSLCertificate{}).Where("type = ? AND deleted_at IS NULL", CertTypeSelfSigned).Count(&count)
	stats.SelfSigned = int(count)

	return &stats, nil
}

// CreateLetsEncrypt creates a Let's Encrypt certificate
func (s *Service) CreateLetsEncrypt(req *CreateLetsEncryptRequest) (*SSLCertificate, error) {
	// Validate domain
	if req.Domain == "" {
		return nil, errors.New("domain is required")
	}

	// Check if certificate already exists
	var existing SSLCertificate
	if err := s.db.Where("domain = ? AND type = ?", req.Domain, CertTypeLetsEncrypt).First(&existing).Error; err == nil {
		return nil, fmt.Errorf("certificate for domain %s already exists", req.Domain)
	}

	// Prepare domains list
	domains := []string{req.Domain}
	if len(req.Domains) > 0 {
		for _, d := range req.Domains {
			if d != req.Domain {
				domains = append(domains, d)
			}
		}
	}

	// Determine if wildcard
	isWildcard := strings.HasPrefix(req.Domain, "*.")

	// Set challenge type
	challengeType := ChallengeHTTP01
	if req.ChallengeType == "dns-01" || isWildcard {
		challengeType = ChallengeDNS01
	}

	// Auto renew default
	autoRenew := true
	if req.AutoRenew != nil {
		autoRenew = *req.AutoRenew
	}

	renewBefore := 30
	if req.RenewBefore > 0 {
		renewBefore = req.RenewBefore
	}

	cert := &SSLCertificate{
		Name:          req.Domain,
		Domain:        req.Domain,
		Domains:       domains,
		IsWildcard:    isWildcard,
		Type:          CertTypeLetsEncrypt,
		Status:        CertStatusPending,
		ChallengeType: challengeType,
		ACMEEmail:     req.Email,
		AutoRenew:     autoRenew,
		RenewBefore:   renewBefore,
		KeyAlgorithm:  "ECDSA",
		KeySize:       256,
	}

	if err := s.db.Create(cert).Error; err != nil {
		return nil, err
	}

	// TODO: Trigger actual ACME certificate issuance in background
	// For now, we just create a pending certificate record
	s.logger.Info("Let's Encrypt certificate request created", "domain", req.Domain, "id", cert.ID)

	return cert, nil
}

// CreateCustom uploads a custom certificate
func (s *Service) CreateCustom(req *CreateCustomCertRequest) (*SSLCertificate, error) {
	if req.Domain == "" || req.Certificate == "" || req.PrivateKey == "" {
		return nil, errors.New("domain, certificate, and private_key are required")
	}

	// Parse and validate certificate
	block, _ := pem.Decode([]byte(req.Certificate))
	if block == nil {
		return nil, errors.New("failed to parse certificate PEM")
	}

	x509Cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %v", err)
	}

	// Parse private key
	keyBlock, _ := pem.Decode([]byte(req.PrivateKey))
	if keyBlock == nil {
		return nil, errors.New("failed to parse private key PEM")
	}

	// Validate key type
	var keyAlgorithm string
	var keySize int
	switch keyBlock.Type {
	case "RSA PRIVATE KEY":
		key, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse RSA private key: %v", err)
		}
		keyAlgorithm = "RSA"
		keySize = key.Size() * 8
	case "EC PRIVATE KEY", "PRIVATE KEY":
		keyAlgorithm = "ECDSA"
		keySize = 256
	default:
		return nil, fmt.Errorf("unsupported key type: %s", keyBlock.Type)
	}

	// Get domains from certificate
	domains := []string{x509Cert.Subject.CommonName}
	for _, san := range x509Cert.DNSNames {
		if san != x509Cert.Subject.CommonName {
			domains = append(domains, san)
		}
	}

	// Determine status
	status := CertStatusActive
	if time.Now().After(x509Cert.NotAfter) {
		status = CertStatusExpired
	} else if time.Until(x509Cert.NotAfter) < 30*24*time.Hour {
		status = CertStatusExpiring
	}

	// Save certificate files
	certDir := s.ensureCertDir()
	certID := strings.ReplaceAll(req.Domain, "*", "_wildcard_")
	certPath := filepath.Join(certDir, certID+".crt")
	keyPath := filepath.Join(certDir, certID+".key")

	if err := os.WriteFile(certPath, []byte(req.Certificate), 0600); err != nil {
		return nil, fmt.Errorf("failed to write certificate file: %v", err)
	}
	if err := os.WriteFile(keyPath, []byte(req.PrivateKey), 0600); err != nil {
		os.Remove(certPath)
		return nil, fmt.Errorf("failed to write key file: %v", err)
	}

	// Create fullchain if chain provided
	fullchainPath := ""
	if req.Chain != "" {
		chainPath := filepath.Join(certDir, certID+".chain.crt")
		fullchainPath = filepath.Join(certDir, certID+".fullchain.crt")
		if err := os.WriteFile(chainPath, []byte(req.Chain), 0600); err != nil {
			s.logger.Warn("Failed to write chain file", "error", err)
		}
		fullchain := req.Certificate + "\n" + req.Chain
		if err := os.WriteFile(fullchainPath, []byte(fullchain), 0600); err != nil {
			s.logger.Warn("Failed to write fullchain file", "error", err)
		}
	}

	name := req.Name
	if name == "" {
		name = req.Domain
	}

	issuedAt := x509Cert.NotBefore
	expiresAt := x509Cert.NotAfter

	cert := &SSLCertificate{
		Name:          name,
		Domain:        req.Domain,
		Domains:       domains,
		IsWildcard:    strings.HasPrefix(req.Domain, "*."),
		Type:          CertTypeCustom,
		Status:        status,
		CertPath:      certPath,
		KeyPath:       keyPath,
		FullchainPath: fullchainPath,
		Issuer:        x509Cert.Issuer.CommonName,
		Subject:       x509Cert.Subject.CommonName,
		SerialNumber:  x509Cert.SerialNumber.String(),
		Fingerprint:   fmt.Sprintf("%x", x509Cert.Signature[:20]),
		KeyAlgorithm:  keyAlgorithm,
		KeySize:       keySize,
		IssuedAt:      &issuedAt,
		ExpiresAt:     &expiresAt,
		AutoRenew:     false, // Custom certs don't auto-renew
		RenewBefore:   30,
	}

	if err := s.db.Create(cert).Error; err != nil {
		os.Remove(certPath)
		os.Remove(keyPath)
		return nil, err
	}

	s.logger.Info("Custom certificate uploaded", "domain", req.Domain, "id", cert.ID)
	return cert, nil
}

// CreateSelfSigned creates a self-signed certificate
func (s *Service) CreateSelfSigned(req *CreateSelfSignedRequest) (*SSLCertificate, error) {
	if req.Domain == "" {
		return nil, errors.New("domain is required")
	}

	validDays := 365
	if req.ValidDays > 0 {
		validDays = req.ValidDays
	}

	keyType := "ECDSA"
	if req.KeyType != "" {
		keyType = strings.ToUpper(req.KeyType)
	}

	keySize := 256
	if req.KeySize > 0 {
		keySize = req.KeySize
	}

	commonName := req.CommonName
	if commonName == "" {
		commonName = req.Domain
	}

	org := req.Organization
	if org == "" {
		org = "VPanel Self-Signed"
	}

	// Prepare domains
	domains := []string{req.Domain}
	for _, d := range req.Domains {
		if d != req.Domain {
			domains = append(domains, d)
		}
	}

	// Generate private key
	var privKey interface{}
	var pubKey interface{}
	var privKeyPEM []byte

	if keyType == "RSA" {
		if keySize < 2048 {
			keySize = 2048
		}
		key, err := rsa.GenerateKey(rand.Reader, keySize)
		if err != nil {
			return nil, fmt.Errorf("failed to generate RSA key: %v", err)
		}
		privKey = key
		pubKey = &key.PublicKey
		privKeyPEM = pem.EncodeToMemory(&pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: x509.MarshalPKCS1PrivateKey(key),
		})
	} else {
		var curve elliptic.Curve
		switch keySize {
		case 384:
			curve = elliptic.P384()
		case 521:
			curve = elliptic.P521()
		default:
			keySize = 256
			curve = elliptic.P256()
		}
		key, err := ecdsa.GenerateKey(curve, rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate ECDSA key: %v", err)
		}
		privKey = key
		pubKey = &key.PublicKey
		keyBytes, _ := x509.MarshalECPrivateKey(key)
		privKeyPEM = pem.EncodeToMemory(&pem.Block{
			Type:  "EC PRIVATE KEY",
			Bytes: keyBytes,
		})
	}

	// Generate certificate
	now := time.Now()
	notAfter := now.AddDate(0, 0, validDays)
	serialNumber, _ := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			CommonName:   commonName,
			Organization: []string{org},
		},
		NotBefore:             now,
		NotAfter:              notAfter,
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              domains,
	}

	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, pubKey, privKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create certificate: %v", err)
	}

	certPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certDER,
	})

	// Save files
	certDir := s.ensureCertDir()
	certID := strings.ReplaceAll(req.Domain, "*", "_wildcard_")
	certPath := filepath.Join(certDir, certID+".selfsigned.crt")
	keyPath := filepath.Join(certDir, certID+".selfsigned.key")

	if err := os.WriteFile(certPath, certPEM, 0600); err != nil {
		return nil, fmt.Errorf("failed to write certificate file: %v", err)
	}
	if err := os.WriteFile(keyPath, privKeyPEM, 0600); err != nil {
		os.Remove(certPath)
		return nil, fmt.Errorf("failed to write key file: %v", err)
	}

	cert := &SSLCertificate{
		Name:         req.Domain,
		Domain:       req.Domain,
		Domains:      domains,
		IsWildcard:   strings.HasPrefix(req.Domain, "*."),
		Type:         CertTypeSelfSigned,
		Status:       CertStatusActive,
		CertPath:     certPath,
		KeyPath:      keyPath,
		Issuer:       org,
		Subject:      commonName,
		SerialNumber: serialNumber.String(),
		KeyAlgorithm: keyType,
		KeySize:      keySize,
		IssuedAt:     &now,
		ExpiresAt:    &notAfter,
		AutoRenew:    false,
		RenewBefore:  30,
	}

	if err := s.db.Create(cert).Error; err != nil {
		os.Remove(certPath)
		os.Remove(keyPath)
		return nil, err
	}

	s.logger.Info("Self-signed certificate created", "domain", req.Domain, "id", cert.ID, "valid_days", validDays)
	return cert, nil
}

// UpdateCertificate updates a certificate
func (s *Service) UpdateCertificate(id string, req *UpdateCertificateRequest) error {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.AutoRenew != nil {
		updates["auto_renew"] = *req.AutoRenew
	}
	if req.RenewBefore != nil {
		updates["renew_before"] = *req.RenewBefore
	}

	if len(updates) == 0 {
		return nil
	}

	return s.db.Model(&SSLCertificate{}).Where("id = ?", id).Updates(updates).Error
}

// DeleteCertificate deletes a certificate
func (s *Service) DeleteCertificate(id string) error {
	var cert SSLCertificate
	if err := s.db.First(&cert, "id = ?", id).Error; err != nil {
		return err
	}

	// Remove certificate files
	if cert.CertPath != "" {
		os.Remove(cert.CertPath)
	}
	if cert.KeyPath != "" {
		os.Remove(cert.KeyPath)
	}
	if cert.ChainPath != "" {
		os.Remove(cert.ChainPath)
	}
	if cert.FullchainPath != "" {
		os.Remove(cert.FullchainPath)
	}

	return s.db.Delete(&cert).Error
}

// RenewCertificate triggers certificate renewal
func (s *Service) RenewCertificate(id string) error {
	var cert SSLCertificate
	if err := s.db.First(&cert, "id = ?", id).Error; err != nil {
		return err
	}

	if cert.Type == CertTypeCustom {
		return errors.New("custom certificates cannot be renewed automatically")
	}

	// TODO: Implement actual ACME renewal
	// For now, just update the record
	now := time.Now()
	updates := map[string]interface{}{
		"status":       CertStatusPending,
		"last_renewed": &now,
		"renew_count":  cert.RenewCount + 1,
	}

	s.logger.Info("Certificate renewal triggered", "id", id, "domain", cert.Domain)
	return s.db.Model(&cert).Updates(updates).Error
}

// ValidateCertificate validates a certificate
func (s *Service) ValidateCertificate(id string) (*SSLValidation, error) {
	cert, err := s.GetCertificate(id)
	if err != nil {
		return nil, err
	}

	validation := &SSLValidation{
		Valid:         true,
		Issues:        []string{},
		DaysRemaining: cert.DaysRemaining(),
	}

	// Check expiry
	if cert.ExpiresAt != nil {
		if time.Now().After(*cert.ExpiresAt) {
			validation.Valid = false
			validation.Issues = append(validation.Issues, "Certificate has expired")
		} else if validation.DaysRemaining < 30 {
			validation.Issues = append(validation.Issues, fmt.Sprintf("Certificate expires in %d days", validation.DaysRemaining))
		}
	}

	// Check if files exist
	if cert.CertPath != "" {
		if _, err := os.Stat(cert.CertPath); os.IsNotExist(err) {
			validation.Valid = false
			validation.Issues = append(validation.Issues, "Certificate file not found")
		}
	}
	if cert.KeyPath != "" {
		if _, err := os.Stat(cert.KeyPath); os.IsNotExist(err) {
			validation.Valid = false
			validation.Issues = append(validation.Issues, "Private key file not found")
		}
	}

	return validation, nil
}

// CheckExpiringCertificates checks for expiring certificates and triggers renewal
func (s *Service) CheckExpiringCertificates() error {
	var certs []SSLCertificate
	
	// Find auto-renew certificates that are expiring
	threshold := time.Now().AddDate(0, 0, 30)
	err := s.db.Where("auto_renew = ? AND expires_at < ? AND type != ?", 
		true, threshold, CertTypeCustom).Find(&certs).Error
	if err != nil {
		return err
	}

	for _, cert := range certs {
		s.logger.Info("Auto-renewing expiring certificate", "id", cert.ID, "domain", cert.Domain)
		if err := s.RenewCertificate(cert.ID); err != nil {
			s.logger.Error("Failed to renew certificate", "id", cert.ID, "error", err)
		}
	}

	return nil
}

