# Hatterm Android App

Android client for [Hatterm](https://github.com/neilmanfredit/hatterm) — connect to a self-hosted hatterm server from your Android device.

## What it does

Hatterm Android is a Capacitor + React terminal app that connects to a **self-hosted hatterm server** over WebSocket. It gives you full terminal access to your hatterm workspaces from any Android phone or tablet.

**Foldable device support** — when opened on a foldable device in book mode (Galaxy Z Fold, Pixel Fold, etc.), the app automatically splits across both panels: server list on the left, terminal on the right.

## Requirements

- Android 8.0+
- A running [hatterm server](https://github.com/neilmanfredit/hatterm) accessible over the network (LAN or internet)
- The server's WebSocket URL and auth token (shown in hatterm's server settings)

## Getting Started

### Connect to a server

1. Open Hatterm on your Android device
2. Tap **+ Add Server**
3. Enter:
   - **Name** — a friendly label (e.g. "Home Server")
   - **URL** — the hatterm server's WebSocket address (e.g. `wss://myserver.example.com:8080`)
   - **Token** — the auth token from your hatterm server settings
4. Tap **Save**, then **Connect**

### Self-hosting the server

Run hatterm (or the standalone `wavesrv` binary) on any Linux/macOS/Windows machine. Enable network mode in hatterm's settings to expose the WebSocket endpoint. See the [hatterm docs](https://github.com/neilmanfredit/hatterm) for details.

## Development

```bash
# Install dependencies
npm install

# Build web assets
npm run build

# Sync to Android
npx cap sync android

# Open in Android Studio
npx cap open android
```

## Building the APK

CI builds an APK on every version tag. See [Releases](https://github.com/neilmanfredit/hatterm-app/releases) to download the latest build.

To build locally:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
```

## Related

- [Hatterm Desktop](https://github.com/neilmanfredit/hatterm) — the full desktop terminal app this connects to

## License

Apache 2.0 — Copyright 2026 Neil Manfred
