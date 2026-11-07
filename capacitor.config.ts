// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.hatterm.app",
    appName: "Hatterm",
    webDir: "dist",
    plugins: {
        StatusBar: {
            style: "dark",
            backgroundColor: "#18181b",
        },
        Keyboard: {
            resize: "body",
            resizeOnFullScreen: true,
        },
    },
    android: {
        backgroundColor: "#18181b",
    },
};

export default config;
