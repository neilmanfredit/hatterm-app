// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ServerConfig } from "./types";

type ConnState = "connecting" | "connected" | "reconnecting" | "disconnected";

interface TerminalViewProps {
    server: ServerConfig;
    onDisconnect: () => void;
}

const IndicatorColor: Record<ConnState, string> = {
    connecting: "#f59e0b",
    connected: "#22c55e",
    reconnecting: "#f59e0b",
    disconnected: "#ef4444",
};

const StateLabel: Record<ConnState, string> = {
    connecting: "Connecting…",
    connected: "",
    reconnecting: "Reconnecting…",
    disconnected: "Disconnected",
};

export function TerminalView({ server, onDisconnect }: TerminalViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const connectFnRef = useRef<(() => void) | null>(null);
    const [connState, setConnState] = useState<ConnState>("connecting");

    const reconnectNow = useCallback(() => {
        if (reconnectTimerRef.current != null) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
        wsRef.current?.close();
        connectFnRef.current?.();
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;

        reconnectAttemptsRef.current = 0;
        let destroyed = false;
        let isFirstConnect = true;

        const term = new Terminal({
            theme: {
                background: "#18181b",
                foreground: "#e4e4e7",
                cursor: "#7c3aed",
                selectionBackground: "rgba(124, 58, 237, 0.3)",
                black: "#18181b",
                brightBlack: "#52525b",
                red: "#ef4444",
                brightRed: "#f87171",
                green: "#22c55e",
                brightGreen: "#4ade80",
                yellow: "#f59e0b",
                brightYellow: "#fbbf24",
                blue: "#3b82f6",
                brightBlue: "#60a5fa",
                magenta: "#a855f7",
                brightMagenta: "#c084fc",
                cyan: "#06b6d4",
                brightCyan: "#22d3ee",
                white: "#e4e4e7",
                brightWhite: "#f4f4f5",
            },
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
            fontSize: 13,
            lineHeight: 1.2,
            cursorBlink: true,
            scrollback: 5000,
            allowProposedApi: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(containerRef.current);
        fitAddon.fit();

        term.onData((data) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "input", data: { input: data } }));
            }
        });

        term.onResize(({ cols, rows }) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "resize", data: { cols, rows } }));
            }
        });

        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => fitAddon.fit()));
        resizeObserver.observe(containerRef.current);

        function connect() {
            if (destroyed) return;
            setConnState("connecting");

            const ws = new WebSocket(`${server.url}/ws?token=${encodeURIComponent(server.token)}`);
            wsRef.current = ws;

            ws.onopen = () => {
                if (destroyed) {
                    ws.close();
                    return;
                }
                setConnState("connected");
                if (isFirstConnect) {
                    isFirstConnect = false;
                    term.writeln(`\x1b[32mConnected to ${server.name}\x1b[0m`);
                    term.writeln(`\x1b[90m${server.url}\x1b[0m\r\n`);
                } else {
                    reconnectAttemptsRef.current = 0;
                    term.writeln("\x1b[32m\r\n[Reconnected]\x1b[0m\r\n");
                }
                ws.send(JSON.stringify({ type: "resize", data: { cols: term.cols, rows: term.rows } }));
            };

            ws.onmessage = (evt) => {
                if (destroyed) return;
                try {
                    const msg = JSON.parse(evt.data as string);
                    if (msg.type === "output" && msg.data?.output) {
                        term.write(msg.data.output);
                    } else if (msg.type === "error" && msg.data?.message) {
                        term.writeln(`\x1b[31m[Server: ${msg.data.message}]\x1b[0m`);
                    }
                } catch {
                    term.write(evt.data as string);
                }
            };

            ws.onclose = () => {
                wsRef.current = null;
                if (destroyed) return;

                term.writeln("\x1b[33m\r\n[Connection lost]\x1b[0m");

                const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                reconnectAttemptsRef.current++;
                setConnState("reconnecting");
                term.writeln(`\x1b[90m[Reconnecting in ${Math.round(delay / 1000)}s…]\x1b[0m`);

                reconnectTimerRef.current = setTimeout(() => {
                    if (!destroyed) connect();
                }, delay);
            };
        }

        connectFnRef.current = connect;
        connect();

        return () => {
            destroyed = true;
            connectFnRef.current = null;
            if (reconnectTimerRef.current != null) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            resizeObserver.disconnect();
            wsRef.current?.close();
            wsRef.current = null;
            term.dispose();
        };
    }, [server]);

    const showReconnect = connState === "reconnecting" || connState === "disconnected";

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                background: "#18181b",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#27272a",
                    borderBottom: "1px solid #3f3f46",
                    flexShrink: 0,
                    gap: 8,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: IndicatorColor[connState],
                            flexShrink: 0,
                        }}
                    />
                    <span
                        style={{
                            color: "#a1a1aa",
                            fontSize: 12,
                            fontFamily: "monospace",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {server.name}
                    </span>
                    {StateLabel[connState] && (
                        <span style={{ color: "#71717a", fontSize: 11, whiteSpace: "nowrap" }}>
                            {StateLabel[connState]}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {showReconnect && (
                        <button
                            onClick={reconnectNow}
                            style={{
                                background: "none",
                                color: "#a855f7",
                                fontSize: 12,
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: "1px solid #a855f7",
                                cursor: "pointer",
                            }}
                        >
                            Reconnect now
                        </button>
                    )}
                    <button
                        onClick={onDisconnect}
                        style={{
                            background: "none",
                            color: "#71717a",
                            fontSize: 12,
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        ✕ Disconnect
                    </button>
                </div>
            </div>
            <div ref={containerRef} style={{ flex: 1, overflow: "hidden", minHeight: 0 }} />
        </div>
    );
}
