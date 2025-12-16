package services

import (
	"bytes"
	"context"
	"errors"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/vpanel/server/internal/models"
	"github.com/vpanel/server/pkg/logger"
	"gorm.io/gorm"
)

// CronService manages cron jobs
type CronService struct {
	db       *gorm.DB
	log      *logger.Logger
	cron     *cron.Cron
	jobs     map[string]cron.EntryID
	jobsLock sync.RWMutex
}

// NewCronService creates a new cron service
func NewCronService(db *gorm.DB, log *logger.Logger) *CronService {
	c := cron.New(cron.WithSeconds())

	svc := &CronService{
		db:   db,
		log:  log,
		cron: c,
		jobs: make(map[string]cron.EntryID),
	}

	// Start cron scheduler
	c.Start()

	// Load existing jobs
	go svc.loadJobs()

	return svc
}

// loadJobs loads all enabled jobs from database
func (s *CronService) loadJobs() {
	var jobs []models.CronJob
	if err := s.db.Where("enabled = ?", true).Find(&jobs).Error; err != nil {
		s.log.Error("Failed to load cron jobs", "error", err)
		return
	}

	for _, job := range jobs {
		if err := s.scheduleJob(&job); err != nil {
			s.log.Error("Failed to schedule job", "job_id", job.ID, "error", err)
		}
	}

	s.log.Info("Cron jobs loaded", "count", len(jobs))
}

// ListJobs returns all cron jobs
func (s *CronService) ListJobs(nodeID string) ([]models.CronJob, error) {
	var jobs []models.CronJob
	query := s.db.Order("created_at DESC")

	if nodeID != "" {
		query = query.Where("node_id = ?", nodeID)
	}

	if err := query.Find(&jobs).Error; err != nil {
		return nil, err
	}

	// Update next run times
	s.jobsLock.RLock()
	for i := range jobs {
		if entryID, ok := s.jobs[jobs[i].ID]; ok {
			entry := s.cron.Entry(entryID)
			if !entry.Next.IsZero() {
				jobs[i].NextRunAt = &entry.Next
			}
		}
	}
	s.jobsLock.RUnlock()

	return jobs, nil
}

// GetJob returns a cron job by ID
func (s *CronService) GetJob(id string) (*models.CronJob, error) {
	var job models.CronJob
	if err := s.db.First(&job, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &job, nil
}

// CreateJob creates a new cron job
func (s *CronService) CreateJob(job *models.CronJob) error {
	// Validate cron expression - support both 5-field and 6-field formats
	schedule, err := parseCronExpression(job.Schedule)
	if err != nil {
		return ErrInvalidCronExpression
	}
	job.Schedule = schedule

	// Set defaults
	if job.Timeout == 0 {
		job.Timeout = 3600 // 1 hour
	}
	if job.User == "" {
		job.User = "root"
	}

	// Save to database
	if err := s.db.Create(job).Error; err != nil {
		return err
	}

	// Schedule if enabled
	if job.Enabled {
		if err := s.scheduleJob(job); err != nil {
			s.log.Error("Failed to schedule new job", "job_id", job.ID, "error", err)
		}
	}

	return nil
}

// UpdateJob updates a cron job
func (s *CronService) UpdateJob(id string, updates map[string]interface{}) (*models.CronJob, error) {
	// Validate cron expression if provided - support both 5-field and 6-field formats
	if schedule, ok := updates["schedule"].(string); ok {
		parsed, err := parseCronExpression(schedule)
		if err != nil {
			return nil, ErrInvalidCronExpression
		}
		updates["schedule"] = parsed
	}

	// Update in database
	if err := s.db.Model(&models.CronJob{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Get updated job
	job, err := s.GetJob(id)
	if err != nil {
		return nil, err
	}

	// Reschedule job
	s.unscheduleJob(id)
	if job.Enabled {
		if err := s.scheduleJob(job); err != nil {
			s.log.Error("Failed to reschedule job", "job_id", id, "error", err)
		}
	}

	return job, nil
}

// DeleteJob deletes a cron job
func (s *CronService) DeleteJob(id string) error {
	// Unschedule first
	s.unscheduleJob(id)

	// Delete from database
	if err := s.db.Delete(&models.CronJob{}, "id = ?", id).Error; err != nil {
		return err
	}

	// Delete logs
	s.db.Delete(&models.CronJobLog{}, "job_id = ?", id)

	return nil
}

// RunJob runs a cron job immediately
func (s *CronService) RunJob(id string) (*models.CronJobLog, error) {
	job, err := s.GetJob(id)
	if err != nil {
		return nil, err
	}

	return s.executeJob(job)
}

// GetJobLogs returns logs for a cron job
func (s *CronService) GetJobLogs(jobID string, limit int) ([]models.CronJobLog, error) {
	if limit <= 0 {
		limit = 50
	}

	var logs []models.CronJobLog
	if err := s.db.Where("job_id = ?", jobID).Order("started_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}

	return logs, nil
}

// scheduleJob schedules a cron job
func (s *CronService) scheduleJob(job *models.CronJob) error {
	s.jobsLock.Lock()
	defer s.jobsLock.Unlock()

	// Remove existing schedule if any
	if entryID, ok := s.jobs[job.ID]; ok {
		s.cron.Remove(entryID)
		delete(s.jobs, job.ID)
	}

	// Add new schedule
	entryID, err := s.cron.AddFunc(job.Schedule, func() {
		_, _ = s.executeJob(job)
	})
	if err != nil {
		return err
	}

	s.jobs[job.ID] = entryID

	// Update next run time
	entry := s.cron.Entry(entryID)
	if !entry.Next.IsZero() {
		s.db.Model(job).Update("next_run_at", entry.Next)
	}

	s.log.Info("Cron job scheduled", "job_id", job.ID, "name", job.Name, "schedule", job.Schedule)
	return nil
}

// unscheduleJob removes a job from the scheduler
func (s *CronService) unscheduleJob(jobID string) {
	s.jobsLock.Lock()
	defer s.jobsLock.Unlock()

	if entryID, ok := s.jobs[jobID]; ok {
		s.cron.Remove(entryID)
		delete(s.jobs, jobID)
		s.log.Info("Cron job unscheduled", "job_id", jobID)
	}
}

// executeJob executes a cron job
func (s *CronService) executeJob(job *models.CronJob) (*models.CronJobLog, error) {
	startedAt := time.Now()

	log := &models.CronJobLog{
		JobID:     job.ID,
		StartedAt: startedAt,
		Status:    "running",
	}

	// Save initial log
	s.db.Create(log)

	// Update job's last run time
	s.db.Model(job).Update("last_run_at", startedAt)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(job.Timeout)*time.Second)
	defer cancel()

	// Execute command
	cmd := exec.CommandContext(ctx, "sh", "-c", job.Command)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	endedAt := time.Now()
	duration := int(endedAt.Sub(startedAt).Milliseconds())

	// Update log
	log.EndedAt = &endedAt
	log.Duration = duration
	log.Output = stdout.String()
	log.Error = stderr.String()

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			log.Status = "timeout"
			log.Error = "Job execution timed out"
		} else {
			log.Status = "failed"
			if exitErr, ok := err.(*exec.ExitError); ok {
				log.ExitCode = exitErr.ExitCode()
			}
		}
	} else {
		log.Status = "success"
		log.ExitCode = 0
	}

	// Update log in database
	s.db.Save(log)

	// Update job's last status
	s.db.Model(job).Update("last_status", log.Status)

	// Update next run time
	s.jobsLock.RLock()
	if entryID, ok := s.jobs[job.ID]; ok {
		entry := s.cron.Entry(entryID)
		if !entry.Next.IsZero() {
			s.db.Model(job).Update("next_run_at", entry.Next)
		}
	}
	s.jobsLock.RUnlock()

	s.log.Info("Cron job executed",
		"job_id", job.ID,
		"name", job.Name,
		"status", log.Status,
		"duration_ms", duration,
	)

	return log, nil
}

// Stop stops the cron scheduler
func (s *CronService) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	s.log.Info("Cron scheduler stopped")
}

// parseCronExpression validates and normalizes cron expression
// Supports both 5-field (minute hour dom month dow) and 6-field (second minute hour dom month dow) formats
func parseCronExpression(expr string) (string, error) {
	expr = strings.TrimSpace(expr)
	fields := strings.Fields(expr)

	// 6-field format (with seconds)
	if len(fields) == 6 {
		parser := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
		if _, err := parser.Parse(expr); err != nil {
			return "", err
		}
		return expr, nil
	}

	// 5-field format (standard cron) - prepend "0" for seconds
	if len(fields) == 5 {
		expr6 := "0 " + expr
		parser := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
		if _, err := parser.Parse(expr6); err != nil {
			return "", err
		}
		return expr6, nil
	}

	return "", errors.New("invalid cron expression: expected 5 or 6 fields")
}

// Errors
var (
	ErrInvalidCronExpression = errors.New("invalid cron expression")
	ErrJobNotFound           = errors.New("job not found")
)
