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
    const [isLoading, setIsLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("wss://");
    const [token, setToken] = useState("");
    const [nameError, setNameError] = useState("");
    const [urlError, setUrlError] = useState("");
    const [tokenError, setTokenError] = useState("");

    useEffect(() => {
        loadServers().then((s) => { setServers(s); setIsLoading(false); });
    }, []);

    async function handleAdd() {
        setNameError(""); setUrlError(""); setTokenError("");
        let valid = true;
        if (!name.trim()) { setNameError("Name is required"); valid = false; }
        if (!url.trim() || (!url.startsWith("ws://") && !url.startsWith("wss://"))) {
            setUrlError("URL must start with ws:// or wss://");
            valid = false;
        }
        if (!token.trim()) { setTokenError("Token is required"); valid = false; }
        if (!valid) return;

        const server: ServerConfig = {
            id: generateId(),
            name: name.trim(),
            url: url.trim().replace(/\/$/, ""),
            token: token.trim(),
        };
        await addServer(server);
        setServers((prev) => [...prev, server]);
        setShowAdd(false);
        setName(""); setUrl("wss://"); setToken("");
    }

    async function handleRemove(id: string) {
        await removeServer(id);
        setServers((prev) => prev.filter((s) => s.id !== id));
        setConfirmRemoveId(null);
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 16, gap: 12 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }} role="img" aria-label="hatterm">⚡</span>
                    <span style={{ fontWeight: 600, fontSize: 16, color: "#e4e4e7" }}>Hatterm</span>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    aria-label="Add server"
                    style={{
                        background: "#7c3aed",
                        color: "#fff",
                        borderRadius: 6,
                        padding: "10px 16px",
                        fontWeight: 500,
                        fontSize: 13,
                        minHeight: 44,
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label htmlFor="new-server-name" style={{ fontSize: 12, color: "#a1a1aa" }}>Name</label>
                        <input
                            id="new-server-name"
                            placeholder="e.g. Home Server"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            aria-describedby={nameError ? "new-server-name-error" : undefined}
                            aria-invalid={!!nameError}
                        />
                        {nameError && <span id="new-server-name-error" style={{ color: "#ef4444", fontSize: 12 }}>{nameError}</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label htmlFor="new-server-url" style={{ fontSize: 12, color: "#a1a1aa" }}>URL</label>
                        <input
                            id="new-server-url"
                            placeholder="wss://host:8443"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            autoCapitalize="none"
                            autoCorrect="off"
                            aria-describedby={urlError ? "new-server-url-error" : undefined}
                            aria-invalid={!!urlError}
                        />
                        {urlError && <span id="new-server-url-error" style={{ color: "#ef4444", fontSize: 12 }}>{urlError}</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label htmlFor="new-server-token" style={{ fontSize: 12, color: "#a1a1aa" }}>Auth token</label>
                        <input
                            id="new-server-token"
                            placeholder="tok_…"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            type="password"
                            aria-describedby={tokenError ? "new-server-token-error" : undefined}
                            aria-invalid={!!tokenError}
                        />
                        {tokenError && <span id="new-server-token-error" style={{ color: "#ef4444", fontSize: 12 }}>{tokenError}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button
                            onClick={handleAdd}
                            style={{
                                flex: 1,
                                background: "#7c3aed",
                                color: "#fff",
                                borderRadius: 6,
                                padding: "10px 0",
                                fontWeight: 500,
                            }}
                        >
                            Save
                        </button>
                        <button
                            onClick={() => { setShowAdd(false); setNameError(""); setUrlError(""); setTokenError(""); }}
                            style={{
                                flex: 1,
                                background: "#3f3f46",
                                color: "#a1a1aa",
                                borderRadius: 6,
                                padding: "10px 0",
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Server list */}
            <div
                role="list"
                aria-label="Servers"
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}
            >
                {isLoading && (
                    <div style={{ textAlign: "center", color: "#52525b", paddingTop: 32 }}>
                        Loading…
                    </div>
                )}
                {!isLoading && servers.length === 0 && !showAdd && (
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
                        <span style={{ fontSize: 40 }} role="img" aria-label="computer">🖥️</span>
                        <span style={{ fontSize: 14 }}>No servers yet</span>
                        <span style={{ fontSize: 12 }}>Tap + Add Server to get started</span>
                    </div>
                )}
                {servers.map((server) => (
                    <div
                        key={server.id}
                        role="listitem"
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
                        {/* Server info (non-interactive) */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, color: "#e4e4e7", fontSize: 14 }}>{server.name}</span>
                            <span style={{ color: "#71717a", fontSize: 11, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {server.url}
                            </span>
                        </div>

                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            {confirmRemoveId === server.id ? (
                                <>
                                    <button
                                        onClick={() => handleRemove(server.id)}
                                        aria-label={`Confirm remove ${server.name}`}
                                        style={{
                                            background: "#dc2626",
                                            color: "#fff",
                                            borderRadius: 6,
                                            padding: "10px 12px",
                                            fontSize: 12,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Remove
                                    </button>
                                    <button
                                        onClick={() => setConfirmRemoveId(null)}
                                        style={{
                                            background: "#3f3f46",
                                            color: "#a1a1aa",
                                            borderRadius: 6,
                                            padding: "10px 10px",
                                            fontSize: 12,
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => onConnect(server)}
                                        aria-label={`Connect to ${server.name}`}
                                        style={{
                                            background: "#7c3aed",
                                            color: "#fff",
                                            borderRadius: 6,
                                            padding: "10px 14px",
                                            fontSize: 12,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Connect
                                    </button>
                                    <button
                                        onClick={() => setConfirmRemoveId(server.id)}
                                        aria-label={`Remove ${server.name}`}
                                        style={{
                                            background: "#3f3f46",
                                            color: "#a1a1aa",
                                            borderRadius: 6,
                                            padding: "10px 10px",
                                            fontSize: 12,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
