package terminal

import (
	"errors"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	sdk "github.com/vpanel/sdk"
)

type Service struct {
	log      sdk.Logger
	sessions map[string]*Session
	mu       sync.RWMutex
}

type Session struct {
	ID     string
	PTY    *os.File
	Cmd    *exec.Cmd
	Active bool
	Cols   int
	Rows   int
}

func NewService(log sdk.Logger) *Service {
	return &Service{
		log:      log,
		sessions: make(map[string]*Session),
	}
}

func (s *Service) CreateSession(id string, cols, rows int) (*Session, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	// Set initial window size
	winSize := &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	}

	ptmx, err := pty.StartWithSize(cmd, winSize)
	if err != nil {
		return nil, err
	}

	session := &Session{
		ID:     id,
		PTY:    ptmx,
		Cmd:    cmd,
		Active: true,
		Cols:   cols,
		Rows:   rows,
	}

	s.mu.Lock()
	s.sessions[id] = session
	s.mu.Unlock()

	s.log.Info("Terminal session created", "id", id, "cols", cols, "rows", rows)

	return session, nil
}

func (s *Service) GetSession(id string) (*Session, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	return session, ok
}

func (s *Service) ResizeSession(id string, cols, rows int) error {
	s.mu.RLock()
	session, ok := s.sessions[id]
	s.mu.RUnlock()

	if !ok {
		return errors.New("session not found")
	}

	winSize := &pty.Winsize{
		Rows: uint16(rows),
		Cols: uint16(cols),
	}

	if err := pty.Setsize(session.PTY, winSize); err != nil {
		return err
	}

	s.mu.Lock()
	session.Cols = cols
	session.Rows = rows
	s.mu.Unlock()

	return nil
}

func (s *Service) CloseSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[id]
	if !ok {
		return nil
	}

	session.Active = false
	session.PTY.Close()
	if session.Cmd.Process != nil {
		session.Cmd.Process.Kill()
		session.Cmd.Wait()
	}
	delete(s.sessions, id)

	s.log.Info("Terminal session closed", "id", id)

	return nil
}

func (s *Service) ListSessions() []map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(s.sessions))
	for id, session := range s.sessions {
		result = append(result, map[string]interface{}{
			"id":     id,
			"active": session.Active,
			"cols":   session.Cols,
			"rows":   session.Rows,
		})
	}
	return result
}
