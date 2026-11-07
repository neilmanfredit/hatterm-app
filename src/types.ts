// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

export interface ServerConfig {
    id: string;
    name: string;
    url: string; // e.g. wss://myserver.example.com:8080
    token: string;
    lastConnected?: number;
}

export interface Session {
    id: string;
    name: string;
    serverConfigId: string;
    createdAt: number;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface WshRpcMessage {
    reqid?: string;
    resid?: string;
    command?: string;
    data?: unknown;
    error?: string;
    cont?: boolean;
}
