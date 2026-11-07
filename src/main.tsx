// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

import { StatusBar, Style } from "@capacitor/status-bar";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Dark status bar on Android
StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
StatusBar.setBackgroundColor({ color: "#18181b" }).catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
