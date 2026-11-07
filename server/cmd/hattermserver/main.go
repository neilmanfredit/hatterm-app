// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"embed"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/neilmanfredit/hatterm-app/server/internal/auth"
	"github.com/neilmanfredit/hatterm-app/server/internal/config"
	"github.com/neilmanfredit/hatterm-app/server/internal/pairing"
	"github.com/neilmanfredit/hatterm-app/server/internal/terminal"
	"github.com/neilmanfredit/hatterm-app/server/internal/wsrpc"
)

//go:embed web/index.html
var webFiles embed.FS

var startTime = time.Now()

func main() {
	cfg, exists, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if !exists {
		cfg, err = config.MakeDefault()
		if err != nil {
			log.Fatalf("config: %v", err)
		}
		if err := config.Save(cfg); err != nil {
			log.Fatalf("saving config: %v", err)
		}
		fmt.Printf("\n=== First run: hattermserver ===\n")
		fmt.Printf("Config file : %s\n", config.ConfigPath())
		fmt.Printf("Admin token : %s\n\n", cfg.AdminToken)
		fmt.Printf("Open https://<your-ip>%s/admin/ in a browser to manage this server.\n\n", cfg.ListenAddr)
	}

	tokens, err := auth.MakeStore(cfg.DataDir)
	if err != nil {
		log.Fatalf("auth store: %v", err)
	}
	sessions := terminal.MakeManager()

	tlsCfg, err := buildTLSConfig(cfg)
	if err != nil {
		log.Fatalf("tls: %v", err)
	}

	mux := http.NewServeMux()

	// PTY WebSocket endpoint (app-token auth is handled by wsrpc.Handler)
	mux.Handle("/ws", wsrpc.MakeHandler(tokens, sessions))

	// Admin UI (SPA catch-all, no auth — token entered in-browser)
	mux.HandleFunc("/admin/", func(w http.ResponseWriter, r *http.Request) {
		data, _ := webFiles.ReadFile("web/index.html")
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(data)
	})

	// Admin API
	aa := func(h http.HandlerFunc) http.HandlerFunc { return adminAuth(cfg.AdminToken, h) }

	mux.HandleFunc("GET /admin/api/status", aa(handleStatus(cfg, tokens, sessions)))
	mux.HandleFunc("GET /admin/api/sessions", aa(handleSessions(sessions)))
	mux.HandleFunc("GET /admin/api/tokens", aa(handleListTokens(tokens)))
	mux.HandleFunc("POST /admin/api/tokens", aa(handleCreateToken(tokens)))
	mux.HandleFunc("DELETE /admin/api/tokens/{id}", aa(handleRevokeToken(tokens)))
	mux.HandleFunc("POST /admin/api/pairing", aa(handlePairing(tokens, cfg)))

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		TLSConfig:    tlsCfg,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // disabled for WebSocket
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("hattermserver starting — https://%s%s", resolveHost(cfg), cfg.ListenAddr)
	log.Printf("admin UI: https://%s%s/admin/", resolveHost(cfg), cfg.ListenAddr)
	if err := srv.ListenAndServeTLS("", ""); err != nil {
		log.Fatal(err)
	}
}

// --- TLS ---

func buildTLSConfig(cfg *config.Config) (*tls.Config, error) {
	var cert tls.Certificate
	var err error
	if cfg.CertFile != "" && cfg.KeyFile != "" {
		cert, err = tls.LoadX509KeyPair(cfg.CertFile, cfg.KeyFile)
	} else {
		cert, err = loadOrGenerateSelfSigned(cfg)
	}
	if err != nil {
		return nil, err
	}
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
	}, nil
}

func loadOrGenerateSelfSigned(cfg *config.Config) (tls.Certificate, error) {
	certPath := filepath.Join(cfg.DataDir, "cert.pem")
	keyPath := filepath.Join(cfg.DataDir, "key.pem")

	if cert, err := tls.LoadX509KeyPair(certPath, keyPath); err == nil {
		return cert, nil
	}

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}

	sans := []string{"localhost"}
	if cfg.Domain != "" {
		sans = append(sans, cfg.Domain, "*."+cfg.Domain)
	}
	if cfg.ServerName != "" && cfg.ServerName != cfg.Domain {
		sans = append(sans, cfg.ServerName)
	}

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: cfg.ServerName},
		DNSNames:     sans,
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(10 * 365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}

	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
	keyBytes, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})

	if err := os.WriteFile(certPath, certPEM, 0600); err != nil {
		return tls.Certificate{}, fmt.Errorf("saving cert: %w", err)
	}
	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		return tls.Certificate{}, fmt.Errorf("saving key: %w", err)
	}

	log.Printf("generated self-signed TLS cert → %s", certPath)
	return tls.X509KeyPair(certPEM, keyPEM)
}

// --- Helpers ---

func adminAuth(token string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if strings.HasPrefix(auth, "Bearer ") {
			auth = auth[7:]
		}
		if auth != token {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func wsURL(cfg *config.Config) string {
	host := cfg.Domain
	if host == "" {
		host = resolveHost(cfg)
	}
	_, port, err := net.SplitHostPort(cfg.ListenAddr)
	if err != nil || port == "" {
		port = config.DefaultPort
	}
	return fmt.Sprintf("wss://%s:%s/ws", host, port)
}

func resolveHost(cfg *config.Config) string {
	if cfg.Domain != "" {
		return cfg.Domain
	}
	h, _ := os.Hostname()
	if h == "" {
		return "localhost"
	}
	return h
}

// --- Admin API handlers ---

func handleStatus(cfg *config.Config, tokens *auth.Store, sessions *terminal.Manager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]interface{}{
			"servername":   cfg.ServerName,
			"version":      "1",
			"listenaddr":   cfg.ListenAddr,
			"uptimesecs":   int(time.Since(startTime).Seconds()),
			"sessioncount": len(sessions.List()),
			"tokencount":   len(tokens.List()),
		})
	}
}

func handleSessions(sessions *terminal.Manager) http.HandlerFunc {
	type sessionInfo struct {
		ID        string    `json:"id"`
		TokenID   string    `json:"tokenid"`
		CreatedAt time.Time `json:"createdat"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		list := sessions.List()
		out := make([]sessionInfo, len(list))
		for i, s := range list {
			out[i] = sessionInfo{ID: s.ID, TokenID: s.TokenID, CreatedAt: s.CreatedAt}
		}
		writeJSON(w, out)
	}
}

func handleListTokens(tokens *auth.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, tokens.List())
	}
}

func handleCreateToken(tokens *auth.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
			http.Error(w, "name required", http.StatusBadRequest)
			return
		}
		tok, err := tokens.Generate(req.Name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
		writeJSON(w, tok)
	}
}

func handleRevokeToken(tokens *auth.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if err := tokens.Revoke(id); err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func handlePairing(tokens *auth.Store, cfg *config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name  string `json:"name"`
			WSURL string `json:"wsurl"`
		}
		json.NewDecoder(r.Body).Decode(&req)
		if req.Name == "" {
			req.Name = "Mobile Device"
		}
		url := req.WSURL
		if url == "" {
			url = wsURL(cfg)
		}
		certFile := cfg.CertFile
		if certFile == "" {
			certFile = filepath.Join(cfg.DataDir, "cert.pem")
		}
		tok, err := tokens.Generate(req.Name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		lf, err := pairing.MakeLinkFile(cfg.ServerName, url, tok.Token, certFile)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, lf)
	}
}
