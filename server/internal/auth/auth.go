// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package auth

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const tokenFile = "tokens.json"

type Token struct {
	ID        string    `json:"id"`
	Token     string    `json:"token"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdat"`
	LastUsed  time.Time `json:"lastused"`
	Revoked   bool      `json:"revoked"`
}

type Store struct {
	lock    sync.RWMutex
	dataDir string
	tokens  map[string]*Token // keyed by token value
}

func MakeStore(dataDir string) (*Store, error) {
	s := &Store{
		dataDir: dataDir,
		tokens:  make(map[string]*Token),
	}
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("creating data dir: %w", err)
	}
	_ = s.load() // ok if file doesn't exist yet
	return s, nil
}

func (s *Store) Validate(token string) bool {
	s.lock.RLock()
	t, ok := s.tokens[token]
	s.lock.RUnlock()
	if !ok || t.Revoked {
		return false
	}
	s.lock.Lock()
	defer s.lock.Unlock()
	t.LastUsed = time.Now()
	_ = s.saveLocked()
	return true
}

func (s *Store) Generate(name string) (*Token, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	t := &Token{
		ID:        hex.EncodeToString(b[:8]),
		Token:     "tok_" + hex.EncodeToString(b),
		Name:      name,
		CreatedAt: time.Now(),
	}
	s.lock.Lock()
	defer s.lock.Unlock()
	s.tokens[t.Token] = t
	if err := s.saveLocked(); err != nil {
		return nil, err
	}
	return t, nil
}

func (s *Store) Revoke(id string) error {
	s.lock.Lock()
	defer s.lock.Unlock()
	for _, t := range s.tokens {
		if t.ID == id {
			t.Revoked = true
			return s.saveLocked()
		}
	}
	return fmt.Errorf("token not found")
}

func (s *Store) List() []*Token {
	s.lock.RLock()
	defer s.lock.RUnlock()
	out := make([]*Token, 0, len(s.tokens))
	for _, t := range s.tokens {
		copy := *t
		out = append(out, &copy)
	}
	return out
}

func (s *Store) load() error {
	data, err := os.ReadFile(filepath.Join(s.dataDir, tokenFile))
	if err != nil {
		return err
	}
	var tokens []*Token
	if err := json.Unmarshal(data, &tokens); err != nil {
		return err
	}
	for _, t := range tokens {
		s.tokens[t.Token] = t
	}
	return nil
}

func (s *Store) saveLocked() error {
	tokens := make([]*Token, 0, len(s.tokens))
	for _, t := range s.tokens {
		tokens = append(tokens, t)
	}
	data, err := json.MarshalIndent(tokens, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.dataDir, tokenFile), data, 0600)
}
