// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Preferences } from "@capacitor/preferences";
import type { ServerConfig } from "./types";

const SERVERS_KEY = "hatterm:servers";

type StoredServer = Omit<ServerConfig, "token">;

function tokenKey(id: string) {
    return `hatterm:token:${id}`;
}

export async function loadServers(): Promise<ServerConfig[]> {
    const { value } = await Preferences.get({ key: SERVERS_KEY });
    if (!value) return [];
    let stored: StoredServer[];
    try {
        stored = JSON.parse(value);
    } catch {
        return [];
    }
    const servers = await Promise.all(
        stored.map(async (s) => {
            const token = await SecureStorage.getItem(tokenKey(s.id)).catch(() => null);
            return { ...s, token: token ?? "" };
        })
    );
    return servers;
}

export async function saveServers(servers: ServerConfig[]): Promise<void> {
    const stored: StoredServer[] = servers.map(({ token: _t, ...rest }) => rest);
    await Preferences.set({ key: SERVERS_KEY, value: JSON.stringify(stored) });
    await Promise.all(
        servers.map((s) =>
            s.token ? SecureStorage.setItem(tokenKey(s.id), s.token) : Promise.resolve()
        )
    );
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
    await SecureStorage.removeItem(tokenKey(id)).catch(() => {});
}
