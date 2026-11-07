// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import { addServer, loadServers, removeServer } from "./storage";
import type { ServerConfig } from "./types";

interface ServerListProps {
    onConnect: (server: ServerConfig) => void;
}

function generateId() {
    return crypto.randomUUID();
}

export function ServerList({ onConnect }: ServerListProps) {
    const [servers, setServers] = useState<ServerConfig[]>([]);
    const [showAdd, setShowAdd] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("wss://");
    const [token, setToken] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        loadServers().then(setServers);
    }, []);

    async function handleAdd() {
        setError("");
        if (!name.trim()) { setError("Name is required"); return; }
        if (!url.trim() || (!url.startsWith("ws://") && !url.startsWith("wss://"))) {
            setError("URL must start with ws:// or wss://");
            return;
        }
        if (!token.trim()) { setError("Token is required"); return; }

        const server: ServerConfig = {
            id: generateId(),
            name: name.trim(),
            url: url.trim().replace(/\/$/, ""),
            token: token.trim(),
        };
        await addServer(server);
        const updated = await loadServers();
        setServers(updated);
        setShowAdd(false);
        setName(""); setUrl("wss://"); setToken("");
    }

    async function handleRemove(id: string) {
        await removeServer(id);
        setServers((prev) => prev.filter((s) => s.id !== id));
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 12 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>⚡</span>
                    <span style={{ fontWeight: 600, fontSize: 16, color: "#e4e4e7" }}>Hatterm</span>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    style={{
                        background: "#7c3aed",
                        color: "#fff",
                        borderRadius: 6,
                        padding: "6px 14px",
                        fontWeight: 500,
                        fontSize: 13,
                    }}
                >
                    + Add Server
                </button>
            </div>

            {/* Add server form */}
            {showAdd && (
                <div
                    style={{
                        background: "#27272a",
                        border: "1px solid #3f3f46",
                        borderRadius: 10,
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    <span style={{ fontWeight: 600, color: "#e4e4e7" }}>New Server</span>
                    <input
                        placeholder="Name (e.g. Home Server)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <input
                        placeholder="URL (wss://host:8080)"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                    <input
                        placeholder="Auth token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        type="password"
                    />
                    {error && <span style={{ color: "#ef4444", fontSize: 12 }}>{error}</span>}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={handleAdd}
                            style={{
                                flex: 1,
                                background: "#7c3aed",
                                color: "#fff",
                                borderRadius: 6,
                                padding: "8px 0",
                                fontWeight: 500,
                            }}
                        >
                            Save
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setError(""); }}
                            style={{
                                flex: 1,
                                background: "#3f3f46",
                                color: "#a1a1aa",
                                borderRadius: 6,
                                padding: "8px 0",
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Server list */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {servers.length === 0 && !showAdd && (
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#52525b",
                            gap: 8,
                            textAlign: "center",
                        }}
                    >
                        <span style={{ fontSize: 40 }}>🖥️</span>
                        <span style={{ fontSize: 14 }}>No servers yet</span>
                        <span style={{ fontSize: 12 }}>
                            Add a hatterm server to connect from your Android device
                        </span>
                    </div>
                )}
                {servers.map((server) => (
                    <div
                        key={server.id}
                        style={{
                            background: "#27272a",
                            border: "1px solid #3f3f46",
                            borderRadius: 10,
                            padding: "12px 14px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                        }}
                    >
                        <button
                            onClick={() => onConnect(server)}
                            style={{
                                flex: 1,
                                background: "none",
                                textAlign: "left",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            }}
                        >
                            <span style={{ fontWeight: 600, color: "#e4e4e7", fontSize: 14 }}>{server.name}</span>
                            <span style={{ color: "#71717a", fontSize: 11, fontFamily: "monospace" }}>
                                {server.url}
                            </span>
                        </button>
                        <div style={{ display: "flex", gap: 6 }}>
                            <button
                                onClick={() => onConnect(server)}
                                style={{
                                    background: "#7c3aed",
                                    color: "#fff",
                                    borderRadius: 6,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 500,
                                }}
                            >
                                Connect
                            </button>
                            <button
                                onClick={() => handleRemove(server.id)}
                                style={{
                                    background: "#3f3f46",
                                    color: "#a1a1aa",
                                    borderRadius: 6,
                                    padding: "6px 10px",
                                    fontSize: 12,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
