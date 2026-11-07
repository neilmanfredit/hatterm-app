// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package terminal

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"
)

const (
	DefaultShell = "/bin/bash"
	DefaultCols  = 220
	DefaultRows  = 50
)

type Session struct {
	ID        string
	TokenID   string
	CreatedAt time.Time
	ptmx      *os.File
	cmd       *exec.Cmd
	lock      sync.Mutex
	done      chan struct{}
}

type Manager struct {
	lock     sync.RWMutex
	sessions map[string]*Session
}

func MakeManager() *Manager {
	return &Manager{sessions: make(map[string]*Session)}
}

func (m *Manager) New(id, tokenID string, cols, rows uint16) (*Session, error) {
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = DefaultShell
	}

	cmd := exec.Command(shell, "-l")
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	if cols == 0 {
		cols = DefaultCols
	}
	if rows == 0 {
		rows = DefaultRows
	}

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return nil, fmt.Errorf("starting pty: %w", err)
	}

	s := &Session{
		ID:        id,
		TokenID:   tokenID,
		CreatedAt: time.Now(),
		ptmx:      ptmx,
		cmd:       cmd,
		done:      make(chan struct{}),
	}

	go func() {
		_ = cmd.Wait()
		close(s.done)
	}()

	m.lock.Lock()
	defer m.lock.Unlock()
	m.sessions[id] = s
	return s, nil
}

func (m *Manager) Remove(id string) {
	m.lock.Lock()
	defer m.lock.Unlock()
	if s, ok := m.sessions[id]; ok {
		s.Close()
		delete(m.sessions, id)
	}
}

func (m *Manager) List() []*Session {
	m.lock.RLock()
	defer m.lock.RUnlock()
	out := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, s)
	}
	return out
}

func (s *Session) Read(buf []byte) (int, error) {
	return s.ptmx.Read(buf)
}

func (s *Session) Write(data []byte) (int, error) {
	s.lock.Lock()
	defer s.lock.Unlock()
	return s.ptmx.Write(data)
}

func (s *Session) Resize(cols, rows uint16) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	return pty.Setsize(s.ptmx, &pty.Winsize{Cols: cols, Rows: rows})
}

func (s *Session) Done() <-chan struct{} {
	return s.done
}

func (s *Session) Close() {
	_ = s.ptmx.Close()
	_ = s.cmd.Process.Kill()
}
