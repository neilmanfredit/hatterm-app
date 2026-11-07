// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package pairing

import (
	"crypto/sha256"
	"crypto/tls"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"time"
)

// LinkFile is the .hattermlink JSON that gets imported into the Android app.
type LinkFile struct {
	Version     int    `json:"v"`
	ServerName  string `json:"servername"`
	URL         string `json:"url"`
	Token       string `json:"token"`
	Fingerprint string `json:"fingerprint"` // SHA-256 of the server's TLS leaf cert
	IssuedAt    int64  `json:"issuedat"`
}

func MakeLinkFile(serverName, wsURL, token, certFile string) (*LinkFile, error) {
	fp, err := certFingerprint(certFile)
	if err != nil {
		// non-fatal: fingerprint is advisory for TOFU
		fp = ""
	}
	return &LinkFile{
		Version:     1,
		ServerName:  serverName,
		URL:         wsURL,
		Token:       token,
		Fingerprint: fp,
		IssuedAt:    time.Now().Unix(),
	}, nil
}

func (lf *LinkFile) JSON() ([]byte, error) {
	return json.MarshalIndent(lf, "", "  ")
}

// certFingerprint returns the SHA-256 hex fingerprint of the first cert in the PEM file.
func certFingerprint(certFile string) (string, error) {
	if certFile == "" {
		return "", fmt.Errorf("no cert file configured")
	}
	data, err := os.ReadFile(certFile)
	if err != nil {
		return "", err
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return "", fmt.Errorf("no PEM block found")
	}
	cert, err := tls.X509KeyPair(data, data)
	if err != nil {
		// Just hash the raw DER bytes
		sum := sha256.Sum256(block.Bytes)
		return fmt.Sprintf("%x", sum), nil
	}
	sum := sha256.Sum256(cert.Certificate[0])
	return fmt.Sprintf("%x", sum), nil
}
