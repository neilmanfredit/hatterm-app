// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package config

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const DefaultPort = "8443"

type Config struct {
	ListenAddr  string `json:"listenaddr"`  // e.g. ":8443"
	Domain      string `json:"domain"`      // e.g. myserver.example.com
	CertFile    string `json:"certfile"`    // path to wildcard cert PEM
	KeyFile     string `json:"keyfile"`     // path to wildcard key PEM
	ACMEDomain  string `json:"acmedomain"`  // set to use Let's Encrypt instead of cert files
	DataDir     string `json:"datadir"`     // where tokens/state are stored
	AdminToken  string `json:"admintoken"`  // generated on first run
	ServerName  string `json:"servername"`  // display name shown in app
}

func DefaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "/var/lib/hattermserver"
	}
	return filepath.Join(home, ".local", "share", "hattermserver")
}

func ConfigPath() string {
	return filepath.Join(DefaultDataDir(), "config.json")
}

func Load() (*Config, bool, error) {
	path := ConfigPath()
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("reading config: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, false, fmt.Errorf("parsing config: %w", err)
	}
	return &cfg, true, nil
}

func Save(cfg *Config) error {
	if err := os.MkdirAll(filepath.Dir(ConfigPath()), 0700); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigPath(), data, 0600)
}

func MakeDefault() (*Config, error) {
	adminToken, err := generateToken("adm")
	if err != nil {
		return nil, err
	}
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "hattermserver"
	}
	return &Config{
		ListenAddr: ":" + DefaultPort,
		DataDir:    DefaultDataDir(),
		AdminToken: adminToken,
		ServerName: hostname,
	}, nil
}

func generateToken(prefix string) (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + "_" + hex.EncodeToString(b), nil
}
