package nginx

import (
	"os/exec"

	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

type Service struct {
	db  *gorm.DB
	log sdk.Logger
}

func NewService(db *gorm.DB, log sdk.Logger) *Service {
	return &Service{db: db, log: log}
}

// Instance operations
func (s *Service) ListInstances() ([]NginxInstance, error) {
	var instances []NginxInstance
	return instances, s.db.Find(&instances).Error
}

func (s *Service) CreateInstance(instance *NginxInstance) error {
	return s.db.Create(instance).Error
}

func (s *Service) GetInstance(id string) (*NginxInstance, error) {
	var instance NginxInstance
	return &instance, s.db.First(&instance, "id = ?", id).Error
}

func (s *Service) UpdateInstance(id string, updates map[string]interface{}) error {
	return s.db.Model(&NginxInstance{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) DeleteInstance(id string) error {
	return s.db.Delete(&NginxInstance{}, "id = ?", id).Error
}

// Site operations
func (s *Service) ListSites(instanceID string) ([]NginxSite, error) {
	var sites []NginxSite
	query := s.db
	if instanceID != "" {
		query = query.Where("instance_id = ?", instanceID)
	}
	return sites, query.Find(&sites).Error
}

func (s *Service) CreateSite(site *NginxSite) error {
	return s.db.Create(site).Error
}

func (s *Service) GetSite(id string) (*NginxSite, error) {
	var site NginxSite
	return &site, s.db.First(&site, "id = ?", id).Error
}

func (s *Service) UpdateSite(id string, updates map[string]interface{}) error {
	return s.db.Model(&NginxSite{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Service) DeleteSite(id string) error {
	return s.db.Delete(&NginxSite{}, "id = ?", id).Error
}

func (s *Service) EnableSite(id string) error {
	return s.db.Model(&NginxSite{}).Where("id = ?", id).Update("enabled", true).Error
}

func (s *Service) DisableSite(id string) error {
	return s.db.Model(&NginxSite{}).Where("id = ?", id).Update("enabled", false).Error
}

// Certificate operations
func (s *Service) ListCertificates() ([]SSLCertificate, error) {
	var certs []SSLCertificate
	return certs, s.db.Find(&certs).Error
}

func (s *Service) CreateCertificate(cert *SSLCertificate) error {
	return s.db.Create(cert).Error
}

func (s *Service) DeleteCertificate(id string) error {
	return s.db.Delete(&SSLCertificate{}, "id = ?", id).Error
}

// Nginx control
func (s *Service) ReloadNginx() error {
	cmd := exec.Command("nginx", "-s", "reload")
	return cmd.Run()
}

func (s *Service) TestConfig() error {
	cmd := exec.Command("nginx", "-t")
	return cmd.Run()
}

func (s *Service) GetStatus() (map[string]interface{}, error) {
	return map[string]interface{}{
		"status":  "running",
		"version": "1.24.0",
	}, nil
}
