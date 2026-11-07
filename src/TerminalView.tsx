// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import type { ServerConfig } from "./types";

interface TerminalViewProps {
    server: ServerConfig;
    onDisconnect: () => void;
}

export function TerminalView({ server, onDisconnect }: TerminalViewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

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
        const webLinksAddon = new WebLinksAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(webLinksAddon);
        term.open(containerRef.current);
        fitAddon.fit();
        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect via WebSocket to the hatterm server
        const ws = new WebSocket(`${server.url}/wshrpc?token=${encodeURIComponent(server.token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
            term.writeln("\x1b[32mConnected to hatterm server\x1b[0m");
            term.writeln(`\x1b[90m${server.url}\x1b[0m`);
            term.writeln("");
            // Request a new shell session
            const initMsg = JSON.stringify({
                reqid: crypto.randomUUID(),
                command: "openterm",
                data: { cols: term.cols, rows: term.rows },
            });
            ws.send(initMsg);
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.data?.output) {
                    term.write(msg.data.output);
                }
            } catch {
                // raw data fallback
                term.write(evt.data);
            }
        };

        ws.onerror = () => {
            term.writeln("\x1b[31mConnection error\x1b[0m");
        };

        ws.onclose = () => {
            term.writeln("\x1b[33m\r\nDisconnected from server\x1b[0m");
        };

        // Send terminal input to server
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ command: "input", data: { input: data } }));
            }
        });

        // Send resize events
        term.onResize(({ cols, rows }) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ command: "resize", data: { cols, rows } }));
            }
        });

        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => fitAddon.fit());
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            ws.close();
            term.dispose();
            termRef.current = null;
            wsRef.current = null;
        };
    }, [server]);

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
            {/* Terminal toolbar */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#27272a",
                    borderBottom: "1px solid #3f3f46",
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#22c55e",
                        }}
                    />
                    <span style={{ color: "#a1a1aa", fontSize: 12, fontFamily: "monospace" }}>{server.name}</span>
                </div>
                <button
                    onClick={onDisconnect}
                    style={{
                        background: "none",
                        color: "#71717a",
                        fontSize: 12,
                        padding: "4px 8px",
                        borderRadius: 4,
                    }}
                >
                    ✕ Disconnect
                </button>
            </div>

            {/* xterm container */}
            <div ref={containerRef} style={{ flex: 1, overflow: "hidden", minHeight: 0 }} />
        </div>
    );
}
