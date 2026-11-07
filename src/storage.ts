// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { Preferences } from "@capacitor/preferences";
import type { ServerConfig } from "./types";

const SERVERS_KEY = "hatterm:servers";

export async function loadServers(): Promise<ServerConfig[]> {
    const { value } = await Preferences.get({ key: SERVERS_KEY });
    if (!value) return [];
    try {
        return JSON.parse(value);
    } catch {
        return [];
    }
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
    await Preferences.set({ key: SERVERS_KEY, value: JSON.stringify(servers) });
}

export async function addServer(server: ServerConfig): Promise<void> {
    const servers = await loadServers();
    const existing = servers.findIndex((s) => s.id === server.id);
    if (existing >= 0) {
        servers[existing] = server;
    } else {
        servers.push(server);
    }
    await saveServers(servers);
}

export async function removeServer(id: string): Promise<void> {
    const servers = await loadServers();
    await saveServers(servers.filter((s) => s.id !== id));
}
