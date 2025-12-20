package database

import (
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

func (s *Service) ListServers() ([]DatabaseServer, error) {
	var servers []DatabaseServer
	return servers, s.db.Find(&servers).Error
}

func (s *Service) CreateServer(server *DatabaseServer) error {
	return s.db.Create(server).Error
}

func (s *Service) DeleteServer(id string) error {
	return s.db.Delete(&DatabaseServer{}, "id = ?", id).Error
}

func (s *Service) GetServer(id string) (*DatabaseServer, error) {
	var server DatabaseServer
	return &server, s.db.First(&server, "id = ?", id).Error
}

func (s *Service) ListBackups() ([]DatabaseBackup, error) {
	var backups []DatabaseBackup
	return backups, s.db.Order("created_at desc").Find(&backups).Error
}

func (s *Service) CreateBackup(backup *DatabaseBackup) error {
	return s.db.Create(backup).Error
}

func (s *Service) GetBackup(id string) (*DatabaseBackup, error) {
	var backup DatabaseBackup
	return &backup, s.db.First(&backup, "id = ?", id).Error
}

func (s *Service) DeleteBackup(id string) error {
	return s.db.Delete(&DatabaseBackup{}, "id = ?", id).Error
}
