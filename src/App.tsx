// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { useState } from "react";
import { ServerList } from "./ServerList";
import { TerminalView } from "./TerminalView";
import type { ServerConfig } from "./types";
import { useFoldable } from "./useFoldable";

export default function App() {
    const [activeServer, setActiveServer] = useState<ServerConfig | null>(null);
    const fold = useFoldable();

    // On foldable devices in book mode, show server list on the left panel
    // and terminal on the right panel simultaneously.
    if (fold.isFolded) {
        return (
            <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
                {/* Left panel — server list */}
                <div
                    style={{
                        width: fold.seamX || "40%",
                        flexShrink: 0,
                        borderRight: "2px solid #3f3f46",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        background: "#18181b",
                    }}
                >
                    <ServerList onConnect={setActiveServer} />
                </div>

                {/* Right panel — terminal or placeholder */}
                <div style={{ flex: 1, overflow: "hidden", background: "#18181b" }}>
                    {activeServer ? (
                        <TerminalView server={activeServer} onDisconnect={() => setActiveServer(null)} />
                    ) : (
                        <div
                            style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#52525b",
                                gap: 12,
                                textAlign: "center",
                                padding: 24,
                            }}
                        >
                            <span style={{ fontSize: 48 }}>⚡</span>
                            <span style={{ fontSize: 16, fontWeight: 600, color: "#71717a" }}>
                                Select a server to connect
                            </span>
                            <span style={{ fontSize: 13, color: "#52525b" }}>
                                Choose a server from the left panel
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Standard single-panel layout (phone / folded device)
    return (
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
            {activeServer ? (
                <TerminalView server={activeServer} onDisconnect={() => setActiveServer(null)} />
            ) : (
                <ServerList onConnect={setActiveServer} />
            )}
        </div>
    );
}
