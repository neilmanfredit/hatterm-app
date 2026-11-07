// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

package wsrpc

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/neilmanfredit/hatterm-app/server/internal/auth"
	"github.com/neilmanfredit/hatterm-app/server/internal/terminal"
)

const (
	MsgInput     = "input"
	MsgResize    = "resize"
	MsgOutput    = "output"
	MsgConnected = "connected"
	MsgError     = "error"
	MsgPing      = "ping"
	MsgPong      = "pong"

	writeTimeout = 10 * time.Second
	pongWait     = 60 * time.Second
	pingInterval = 30 * time.Second
	maxMsgSize   = 128 * 1024
)

type Message struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

type InputData struct {
	Input string `json:"input"`
}

type ResizeData struct {
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

type OutputData struct {
	Output string `json:"output"`
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type Handler struct {
	tokens   *auth.Store
	sessions *terminal.Manager
}

func MakeHandler(tokens *auth.Store, sessions *terminal.Manager) *Handler {
	return &Handler{tokens: tokens, sessions: sessions}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		token = r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
	}

	if !h.tokens.Validate(token) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("wsrpc: upgrade error: %v", err)
		return
	}

	sessionID := newID()
	sess, err := h.sessions.New(sessionID, "", terminal.DefaultCols, terminal.DefaultRows)
	if err != nil {
		log.Printf("wsrpc: session create error: %v", err)
		sendError(conn, "failed to start terminal session")
		conn.Close()
		return
	}
	defer h.sessions.Remove(sessionID)

	sendJSON(conn, Message{Type: MsgConnected})

	// PTY → WebSocket
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := sess.Read(buf)
			if err != nil {
				return
			}
			outData, _ := json.Marshal(OutputData{Output: string(buf[:n])})
			if err := sendJSON(conn, Message{Type: MsgOutput, Data: outData}); err != nil {
				return
			}
		}
	}()

	// Ping keepalive
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(writeTimeout))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			case <-sess.Done():
				return
			}
		}
	}()

	conn.SetReadLimit(maxMsgSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	// WebSocket → PTY
	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}
		switch msg.Type {
		case MsgInput:
			var d InputData
			if err := json.Unmarshal(msg.Data, &d); err == nil {
				sess.Write([]byte(d.Input))
			}
		case MsgResize:
			var d ResizeData
			if err := json.Unmarshal(msg.Data, &d); err == nil && d.Cols > 0 && d.Rows > 0 {
				sess.Resize(d.Cols, d.Rows)
			}
		case MsgPing:
			sendJSON(conn, Message{Type: MsgPong})
		}
	}
}

func sendJSON(conn *websocket.Conn, v interface{}) error {
	conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	return conn.WriteJSON(v)
}

func sendError(conn *websocket.Conn, msg string) {
	type errData struct {
		Message string `json:"message"`
	}
	d, _ := json.Marshal(errData{Message: msg})
	sendJSON(conn, Message{Type: MsgError, Data: d})
}

func newID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}
