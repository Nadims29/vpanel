package database

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DatabaseServer struct {
	ID          string         `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
	Name        string         `gorm:"type:varchar(100);not null" json:"name"`
	Type        string         `gorm:"type:varchar(50);not null" json:"type"`
	Host        string         `gorm:"type:varchar(255)" json:"host"`
	Port        int            `json:"port"`
	Username    string         `gorm:"type:varchar(100)" json:"username"`
	Password    string         `gorm:"type:varchar(255)" json:"-"`
	Status      string         `gorm:"type:varchar(20);default:'unknown'" json:"status"`
	ContainerID string         `gorm:"type:varchar(64)" json:"container_id"`
	IsLocal     bool           `gorm:"default:false" json:"is_local"`
}

func (m *DatabaseServer) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}

type DatabaseBackup struct {
	ID          string     `gorm:"primaryKey;type:varchar(36)" json:"id"`
	CreatedAt   time.Time  `json:"created_at"`
	ServerID    string     `gorm:"type:varchar(36);index;not null" json:"server_id"`
	Database    string     `gorm:"type:varchar(100)" json:"database"`
	FileName    string     `gorm:"type:varchar(255)" json:"file_name"`
	FilePath    string     `gorm:"type:varchar(500)" json:"file_path"`
	FileSize    int64      `json:"file_size"`
	Type        string     `gorm:"type:varchar(20)" json:"type"`
	Status      string     `gorm:"type:varchar(20)" json:"status"`
	Error       string     `gorm:"type:text" json:"error"`
	CompletedAt *time.Time `json:"completed_at"`
}

func (m *DatabaseBackup) BeforeCreate(tx *gorm.DB) error {
	if m.ID == "" {
		m.ID = uuid.New().String()
	}
	return nil
}
