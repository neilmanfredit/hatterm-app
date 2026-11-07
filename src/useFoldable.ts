// Copyright 2026 Neil Manfred
// SPDX-License-Identifier: Apache-2.0

// Detects Samsung/Google foldable posture via the CSS Viewport Segments API
// and the experimental Device Posture API. When a fold is open and horizontal,
// we split the UI: server list on the left panel, terminal on the right.

import { useEffect, useState } from "react";

export type FoldPosture = "flat" | "folded" | "unknown";

export interface FoldState {
    isFolded: boolean;
    posture: FoldPosture;
    // pixel offset of the fold seam from the left edge (0 if not folded)
    seamX: number;
}

function readFoldState(): FoldState {
    // CSS Viewport Segments API (Chrome 85+, Samsung Internet 14+)
    const segments = (window as any).visualViewport?.segments ?? [];
    if (segments.length === 2) {
        const left = segments[0];
        const right = segments[1];
        // horizontal fold (book mode): two segments side by side
        if (left.top === right.top) {
            return { isFolded: true, posture: "flat", seamX: left.width };
        }
    }

    // Device Posture API (experimental)
    const posture = (navigator as any).devicePosture?.type;
    if (posture === "folded") {
        return { isFolded: true, posture: "folded", seamX: Math.floor(window.innerWidth / 2) };
    }
    if (posture === "continuous") {
        return { isFolded: false, posture: "flat", seamX: 0 };
    }

    // Heuristic: very wide screen likely means fold open (> 600dp landscape)
    if (window.innerWidth > 600 && window.innerWidth > window.innerHeight * 1.3) {
        return { isFolded: true, posture: "flat", seamX: Math.floor(window.innerWidth / 2) };
    }

    return { isFolded: false, posture: "unknown", seamX: 0 };
}

export function useFoldable(): FoldState {
    const [state, setState] = useState<FoldState>(readFoldState);

    useEffect(() => {
        const update = () => setState(readFoldState());

        window.addEventListener("resize", update);
        window.screen.orientation?.addEventListener("change", update);

        const posture = (navigator as any).devicePosture;
        posture?.addEventListener("change", update);

        return () => {
            window.removeEventListener("resize", update);
            window.screen.orientation?.removeEventListener("change", update);
            posture?.removeEventListener("change", update);
        };
    }, []);

    return state;
}
