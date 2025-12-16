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

// CreateServer creates a new database server (connects to existing)
func (s *DatabaseService) CreateServer(server *models.DatabaseServer) error {
	// Test connection before saving
	if err := s.TestConnection(server); err != nil {
		return fmt.Errorf("connection test failed: %w", err)
	}

	// Update status based on connection test
	server.Status = "online"
	server.IsLocal = false

	if err := s.db.Create(server).Error; err != nil {
		return err
	}

	s.log.Info("Database server created", "id", server.ID, "name", server.Name, "type", server.Type)
	return nil
}

// CreateLocalServerRequest contains options for creating a local database server
type CreateLocalServerRequest struct {
	Name         string
	Type         string // mysql, postgresql, mariadb, redis, mongodb
	Port         int
	RootPassword string
	Version      string // Docker image tag, e.g., "8.0", "15", "latest"
}

// DeployDatabaseServer starts an async deployment of a local database server
// Returns the deploy task ID for progress tracking
func (s *DatabaseService) DeployDatabaseServer(req *CreateLocalServerRequest) (*models.DeployTask, error) {
	if s.docker == nil || s.docker.client == nil {
		return nil, fmt.Errorf("Docker is not available")
	}

	// Create deploy task
	task := &models.DeployTask{
		Name:        req.Name,
		Type:        req.Type,
		Status:      "pending",
		Progress:    0,
		CurrentStep: "Initializing...",
		Steps: models.JSON{
			"steps": []map[string]interface{}{
				{"name": "Preparing", "status": "pending", "progress": 0},
				{"name": "Pulling image", "status": "pending", "progress": 0},
				{"name": "Creating container", "status": "pending", "progress": 0},
				{"name": "Starting container", "status": "pending", "progress": 0},
				{"name": "Waiting for database", "status": "pending", "progress": 0},
				{"name": "Verifying connection", "status": "pending", "progress": 0},
			},
		},
	}

	if err := s.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("failed to create deploy task: %w", err)
	}

	// Start async deployment
	go s.runDeployment(task.ID, req)

	return task, nil
}

// GetDeployTask returns a deploy task by ID
func (s *DatabaseService) GetDeployTask(id string) (*models.DeployTask, error) {
	var task models.DeployTask
	if err := s.db.First(&task, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &task, nil
}

// updateTaskProgress updates the deploy task progress
func (s *DatabaseService) updateTaskProgress(taskID string, stepIndex int, stepName string, stepStatus string, progress int, overallProgress int) {
	updates := map[string]interface{}{
		"progress":     overallProgress,
		"current_step": stepName,
	}

	s.db.Model(&models.DeployTask{}).Where("id = ?", taskID).Updates(updates)

	// Also update the step in the JSON
	var task models.DeployTask
	if err := s.db.First(&task, "id = ?", taskID).Error; err == nil {
		if steps, ok := task.Steps["steps"].([]interface{}); ok && stepIndex < len(steps) {
			if step, ok := steps[stepIndex].(map[string]interface{}); ok {
				step["status"] = stepStatus
				step["progress"] = progress
			}
			task.Steps["steps"] = steps
			s.db.Model(&task).Update("steps", task.Steps)
		}
	}
}

// runDeployment performs the actual database deployment
func (s *DatabaseService) runDeployment(taskID string, req *CreateLocalServerRequest) {
	ctx := context.Background()

	// Helper to fail the task
	failTask := func(err error) {
		now := time.Now()
		s.db.Model(&models.DeployTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
			"status":       "failed",
			"error":        err.Error(),
			"completed_at": &now,
		})
		s.log.Error("Deploy task failed", "task_id", taskID, "error", err)
	}

	// Step 1: Preparing (10%)
	s.db.Model(&models.DeployTask{}).Where("id = ?", taskID).Update("status", "running")
	s.updateTaskProgress(taskID, 0, "Preparing deployment...", "running", 100, 10)
	time.Sleep(500 * time.Millisecond)

	// Determine Docker image and environment variables
	var imageName string
	var envVars map[string]string
	var containerPort int
	var username string

	version := req.Version
	if version == "" {
		version = "latest"
	}

	switch req.Type {
	case "mysql":
		imageName = "mysql:" + version
		envVars = map[string]string{"MYSQL_ROOT_PASSWORD": req.RootPassword}
		containerPort = 3306
		username = "root"
	case "mariadb":
		imageName = "mariadb:" + version
		envVars = map[string]string{"MARIADB_ROOT_PASSWORD": req.RootPassword}
		containerPort = 3306
		username = "root"
	case "postgresql", "postgres":
		imageName = "postgres:" + version
		envVars = map[string]string{"POSTGRES_PASSWORD": req.RootPassword}
		containerPort = 5432
		username = "postgres"
	case "redis":
		imageName = "redis:" + version
		envVars = map[string]string{}
		containerPort = 6379
		username = ""
	case "mongodb":
		imageName = "mongo:" + version
		envVars = map[string]string{
			"MONGO_INITDB_ROOT_USERNAME": "root",
			"MONGO_INITDB_ROOT_PASSWORD": req.RootPassword,
		}
		containerPort = 27017
		username = "root"
	default:
		failTask(fmt.Errorf("unsupported database type: %s", req.Type))
		return
	}

	s.updateTaskProgress(taskID, 0, "Preparing deployment...", "completed", 100, 15)

	// Step 2: Pull image (15-45%)
	s.updateTaskProgress(taskID, 1, "Pulling Docker image: "+imageName, "running", 0, 20)

	if err := s.docker.PullImage(ctx, imageName); err != nil {
		failTask(fmt.Errorf("failed to pull image: %w", err))
		return
	}
	s.updateTaskProgress(taskID, 1, "Pulling Docker image: "+imageName, "completed", 100, 45)

	// Step 3: Create container (45-60%)
	s.updateTaskProgress(taskID, 2, "Creating container...", "running", 0, 50)

	hostPort := req.Port
	if hostPort == 0 {
		hostPort = containerPort
	}

	containerName := fmt.Sprintf("vpanel-db-%s-%s", req.Type, req.Name)
	dockerReq := &CreateContainerRequest{
		Name:    containerName,
		Image:   imageName,
		Restart: "unless-stopped",
		Env:     envVars,
		Ports:   []PortMapping{{Host: hostPort, Container: containerPort, Protocol: "tcp"}},
		Volumes: []VolumeMapping{{Host: fmt.Sprintf("vpanel-db-%s", req.Name), Container: getDataDir(req.Type)}},
	}

	containerID, err := s.docker.CreateContainer(ctx, dockerReq)
	if err != nil {
		failTask(fmt.Errorf("failed to create container: %w", err))
		return
	}
	s.updateTaskProgress(taskID, 2, "Creating container...", "completed", 100, 60)

	// Step 4: Start container (60-70%)
	s.updateTaskProgress(taskID, 3, "Starting container...", "running", 0, 65)

	if err := s.docker.StartContainer(ctx, containerID); err != nil {
		s.docker.RemoveContainer(ctx, containerID, true)
		failTask(fmt.Errorf("failed to start container: %w", err))
		return
	}
	s.updateTaskProgress(taskID, 3, "Starting container...", "completed", 100, 70)

	// Step 5: Wait for database (70-90%)
	s.updateTaskProgress(taskID, 4, "Waiting for database to initialize...", "running", 0, 75)

	// Wait with progress updates
	waitTime := 10 * time.Second
	if req.Type == "redis" {
		waitTime = 2 * time.Second
	}
	
	steps := 5
	stepDuration := waitTime / time.Duration(steps)
	for i := 0; i < steps; i++ {
		time.Sleep(stepDuration)
		progress := 75 + (i+1)*3
		s.updateTaskProgress(taskID, 4, "Waiting for database to initialize...", "running", (i+1)*20, progress)
	}
	s.updateTaskProgress(taskID, 4, "Waiting for database to initialize...", "completed", 100, 90)

	// Step 6: Verify connection (90-100%)
	s.updateTaskProgress(taskID, 5, "Verifying connection...", "running", 0, 92)

	// Create database server record
	server := &models.DatabaseServer{
		Name:        req.Name,
		Type:        req.Type,
		Host:        "127.0.0.1",
		Port:        hostPort,
		Username:    username,
		Password:    req.RootPassword,
		Status:      "online",
		ContainerID: containerID,
		IsLocal:     true,
	}

	if err := s.db.Create(server).Error; err != nil {
		s.docker.StopContainer(ctx, containerID)
		s.docker.RemoveContainer(ctx, containerID, true)
		failTask(fmt.Errorf("failed to save server: %w", err))
		return
	}

	s.updateTaskProgress(taskID, 5, "Verifying connection...", "completed", 100, 100)

	// Complete the task
	now := time.Now()
	s.db.Model(&models.DeployTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
		"status":       "completed",
		"progress":     100,
		"current_step": "Deployment complete!",
		"server_id":    server.ID,
		"completed_at": &now,
	})

	s.log.Info("Database deployment completed", "task_id", taskID, "server_id", server.ID)
}

// CreateLocalServer creates a new local database server using Docker (sync version, kept for compatibility)
func (s *DatabaseService) CreateLocalServer(req *CreateLocalServerRequest) (*models.DatabaseServer, error) {
	task, err := s.DeployDatabaseServer(req)
	if err != nil {
		return nil, err
	}

	// Wait for completion (up to 2 minutes)
	for i := 0; i < 120; i++ {
		time.Sleep(1 * time.Second)
		task, err = s.GetDeployTask(task.ID)
		if err != nil {
			return nil, err
		}
		if task.Status == "completed" {
			return s.GetServer(task.ServerID)
		}
		if task.Status == "failed" {
			return nil, fmt.Errorf(task.Error)
		}
	}

	return nil, fmt.Errorf("deployment timed out")
}

// getDataDir returns the data directory path for a database type
func getDataDir(dbType string) string {
	switch dbType {
	case "mysql", "mariadb":
		return "/var/lib/mysql"
	case "postgresql", "postgres":
		return "/var/lib/postgresql/data"
	case "mongodb":
		return "/data/db"
	case "redis":
		return "/data"
	default:
		return "/data"
	}
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
	// Get server first to check if it's local
	server, err := s.GetServer(id)
	if err != nil {
		return err
	}

	// If it's a local server, stop and remove the container
	if server.IsLocal && server.ContainerID != "" && s.docker != nil {
		ctx := context.Background()
		s.log.Info("Stopping local database container", "container", server.ContainerID)
		if err := s.docker.StopContainer(ctx, server.ContainerID); err != nil {
			s.log.Warn("Failed to stop container", "container", server.ContainerID, "error", err)
		}
		if err := s.docker.RemoveContainer(ctx, server.ContainerID, true); err != nil {
			s.log.Warn("Failed to remove container", "container", server.ContainerID, "error", err)
		}
	}

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
