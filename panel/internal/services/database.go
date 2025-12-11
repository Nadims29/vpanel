package services

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // PostgreSQL driver
	"github.com/vpanel/server/internal/models"
)

// ListServers returns all database servers
func (s *DatabaseService) ListServers() ([]models.DatabaseServer, error) {
	var servers []models.DatabaseServer
	if err := s.db.Order("created_at DESC").Find(&servers).Error; err != nil {
		return nil, err
	}
	return servers, nil
}

// GetServer returns a database server by ID
func (s *DatabaseService) GetServer(id string) (*models.DatabaseServer, error) {
	var server models.DatabaseServer
	if err := s.db.First(&server, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &server, nil
}

// CreateServer creates a new database server
func (s *DatabaseService) CreateServer(server *models.DatabaseServer) error {
	// Test connection before saving
	if err := s.TestConnection(server); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	// Update status based on connection test
	server.Status = "online"

	if err := s.db.Create(server).Error; err != nil {
		return err
	}

	s.log.Info("Database server created", "id", server.ID, "name", server.Name, "type", server.Type)
	return nil
}

// UpdateServer updates a database server
func (s *DatabaseService) UpdateServer(id string, updates map[string]interface{}) error {
	// If connection details are being updated, test the connection
	if _, hasHost := updates["host"]; hasHost {
		var server models.DatabaseServer
		if err := s.db.First(&server, "id = ?", id).Error; err != nil {
			return err
		}

		// Apply updates to server object for testing
		if host, ok := updates["host"].(string); ok {
			server.Host = host
		}
		if port, ok := updates["port"].(int); ok {
			server.Port = port
		}
		if username, ok := updates["username"].(string); ok {
			server.Username = username
		}
		if password, ok := updates["password"].(string); ok {
			server.Password = password
		}

		if err := s.TestConnection(&server); err != nil {
			return fmt.Errorf("connection test failed: %w", err)
		}
		updates["status"] = "online"
	}

	if err := s.db.Model(&models.DatabaseServer{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}

	s.log.Info("Database server updated", "id", id)
	return nil
}

// DeleteServer deletes a database server
func (s *DatabaseService) DeleteServer(id string) error {
	if err := s.db.Delete(&models.DatabaseServer{}, "id = ?", id).Error; err != nil {
		return err
	}

	s.log.Info("Database server deleted", "id", id)
	return nil
}

// TestConnection tests the connection to a database server
func (s *DatabaseService) TestConnection(server *models.DatabaseServer) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	switch server.Type {
	case "mysql", "mariadb":
		return s.testMySQLConnection(ctx, server)
	case "postgresql", "postgres":
		return s.testPostgreSQLConnection(ctx, server)
	case "redis":
		return s.testRedisConnection(ctx, server)
	case "mongodb":
		return s.testMongoDBConnection(ctx, server)
	default:
		return fmt.Errorf("unsupported database type: %s", server.Type)
	}
}

// testMySQLConnection tests MySQL/MariaDB connection
func (s *DatabaseService) testMySQLConnection(ctx context.Context, server *models.DatabaseServer) error {
	// Use TCP connection test for MySQL/MariaDB
	// In production, you would use github.com/go-sql-driver/mysql
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", server.Host, server.Port))
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL server: %w", err)
	}
	defer conn.Close()
	return nil
}

// testPostgreSQLConnection tests PostgreSQL connection
func (s *DatabaseService) testPostgreSQLConnection(ctx context.Context, server *models.DatabaseServer) error {
	// Use PostgreSQL driver which is already in go.mod
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=postgres sslmode=disable",
		server.Host, server.Port, server.Username, server.Password)

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("failed to open PostgreSQL connection: %w", err)
	}
	defer db.Close()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("failed to ping PostgreSQL server: %w", err)
	}

	return nil
}

// testRedisConnection tests Redis connection
func (s *DatabaseService) testRedisConnection(ctx context.Context, server *models.DatabaseServer) error {
	// Redis driver is not included, so we'll use a simple TCP connection test
	// In production, you would use github.com/redis/go-redis/v9
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", server.Host, server.Port), 5*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}
	defer conn.Close()

	// Send PING command
	if _, err := conn.Write([]byte("PING\r\n")); err != nil {
		return fmt.Errorf("failed to send PING to Redis: %w", err)
	}

	// Read response (should be +PONG)
	buffer := make([]byte, 1024)
	if _, err := conn.Read(buffer); err != nil {
		return fmt.Errorf("failed to read response from Redis: %w", err)
	}

	return nil
}

// testMongoDBConnection tests MongoDB connection
func (s *DatabaseService) testMongoDBConnection(ctx context.Context, server *models.DatabaseServer) error {
	// MongoDB driver is not included, so we'll use a simple TCP connection test
	// In production, you would use go.mongodb.org/mongo-driver
	dialer := net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", server.Host, server.Port))
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %w", err)
	}
	defer conn.Close()

	// MongoDB uses a binary protocol, but a simple TCP connection test is enough for now
	return nil
}

// GetServerStatus checks the current status of a database server
func (s *DatabaseService) GetServerStatus(server *models.DatabaseServer) (string, error) {
	if err := s.TestConnection(server); err != nil {
		return "error", nil
	}
	return "online", nil
}

// ListDatabases returns all databases for a server
func (s *DatabaseService) ListDatabases(serverID string) ([]map[string]interface{}, error) {
	_, err := s.GetServer(serverID)
	if err != nil {
		return nil, err
	}

	// This would require actual database connection to list databases
	// For now, return empty list
	// TODO: Implement actual database listing based on server type
	return []map[string]interface{}{}, nil
}

// ListBackups returns all database backups
func (s *DatabaseService) ListBackups(serverID string) ([]models.DatabaseBackup, error) {
	var backups []models.DatabaseBackup
	query := s.db.Order("created_at DESC")

	if serverID != "" {
		query = query.Where("server_id = ?", serverID)
	}

	if err := query.Find(&backups).Error; err != nil {
		return nil, err
	}
	return backups, nil
}

// GetBackup returns a backup by ID
func (s *DatabaseService) GetBackup(id string) (*models.DatabaseBackup, error) {
	var backup models.DatabaseBackup
	if err := s.db.First(&backup, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &backup, nil
}

// CreateBackup creates a new database backup
func (s *DatabaseService) CreateBackup(serverID, database string, backupType string) (*models.DatabaseBackup, error) {
	// Get server info
	server, err := s.GetServer(serverID)
	if err != nil {
		return nil, fmt.Errorf("server not found: %w", err)
	}

	// Generate backup file name
	timestamp := time.Now().Format("20060102_150405")
	dbName := database
	if dbName == "" || dbName == "all" {
		dbName = "all"
	}
	fileName := fmt.Sprintf("%s_%s_%s.sql", server.Name, dbName, timestamp)
	if server.Type == "mongodb" {
		fileName = fmt.Sprintf("%s_%s_%s.tar.gz", server.Name, dbName, timestamp)
	}

	// Determine backup path (use config storage path if available)
	backupPath := fmt.Sprintf("./backups/%s/%s", serverID, fileName)

	// Create backup record
	backup := &models.DatabaseBackup{
		ServerID: serverID,
		Database: database,
		FileName: fileName,
		FilePath: backupPath,
		FileSize: 0,
		Type:     backupType, // manual or scheduled
		Status:   "in_progress",
	}

	if err := s.db.Create(backup).Error; err != nil {
		return nil, err
	}

	// Start backup in background (async)
	go s.performBackup(backup, server)

	s.log.Info("Backup created", "id", backup.ID, "server_id", serverID, "database", database)
	return backup, nil
}

// performBackup performs the actual backup operation
func (s *DatabaseService) performBackup(backup *models.DatabaseBackup, server *models.DatabaseServer) {
	startTime := time.Now()
	var err error

	// Update status to in_progress
	s.db.Model(backup).Update("status", "in_progress")

	// Perform backup based on database type
	switch server.Type {
	case "mysql", "mariadb":
		err = s.backupMySQL(backup, server)
	case "postgresql", "postgres":
		err = s.backupPostgreSQL(backup, server)
	case "mongodb":
		err = s.backupMongoDB(backup, server)
	case "redis":
		err = s.backupRedis(backup, server)
	default:
		err = fmt.Errorf("unsupported database type: %s", server.Type)
	}

	// Update backup status
	completedAt := time.Now()
	duration := completedAt.Sub(startTime)

	updates := map[string]interface{}{
		"completed_at": &completedAt,
	}

	if err != nil {
		updates["status"] = "failed"
		updates["error"] = err.Error()
		s.log.Error("Backup failed", "id", backup.ID, "error", err)
	} else {
		// Get file size
		// TODO: Get actual file size from filesystem
		updates["status"] = "completed"
		updates["file_size"] = int64(0) // Placeholder
		s.log.Info("Backup completed", "id", backup.ID, "duration", duration)
	}

	s.db.Model(backup).Updates(updates)
}

// backupMySQL performs MySQL backup
func (s *DatabaseService) backupMySQL(backup *models.DatabaseBackup, server *models.DatabaseServer) error {
	// TODO: Implement actual MySQL backup using mysqldump
	// For now, simulate backup
	time.Sleep(2 * time.Second)
	return nil
}

// backupPostgreSQL performs PostgreSQL backup
func (s *DatabaseService) backupPostgreSQL(backup *models.DatabaseBackup, server *models.DatabaseServer) error {
	// TODO: Implement actual PostgreSQL backup using pg_dump
	// For now, simulate backup
	time.Sleep(2 * time.Second)
	return nil
}

// backupMongoDB performs MongoDB backup
func (s *DatabaseService) backupMongoDB(backup *models.DatabaseBackup, server *models.DatabaseServer) error {
	// TODO: Implement actual MongoDB backup using mongodump
	// For now, simulate backup
	time.Sleep(2 * time.Second)
	return nil
}

// backupRedis performs Redis backup
func (s *DatabaseService) backupRedis(backup *models.DatabaseBackup, server *models.DatabaseServer) error {
	// TODO: Implement actual Redis backup
	// For now, simulate backup
	time.Sleep(1 * time.Second)
	return nil
}

// DeleteBackup deletes a backup
func (s *DatabaseService) DeleteBackup(id string) error {
	backup, err := s.GetBackup(id)
	if err != nil {
		return err
	}

	// TODO: Delete actual backup file from filesystem

	if err := s.db.Delete(backup).Error; err != nil {
		return err
	}

	s.log.Info("Backup deleted", "id", id)
	return nil
}

// RestoreBackup restores a database from backup
func (s *DatabaseService) RestoreBackup(backupID string, targetServerID, targetDatabase string) error {
	backup, err := s.GetBackup(backupID)
	if err != nil {
		return fmt.Errorf("backup not found: %w", err)
	}

	if backup.Status != "completed" {
		return fmt.Errorf("backup is not completed, cannot restore")
	}

	// Get source and target servers
	_, err = s.GetServer(backup.ServerID)
	if err != nil {
		return fmt.Errorf("source server not found: %w", err)
	}

	_, err = s.GetServer(targetServerID)
	if err != nil {
		return fmt.Errorf("target server not found: %w", err)
	}

	// TODO: Implement actual restore logic based on database type
	s.log.Info("Restore started", "backup_id", backupID, "target_server", targetServerID, "target_database", targetDatabase)
	return nil
}
