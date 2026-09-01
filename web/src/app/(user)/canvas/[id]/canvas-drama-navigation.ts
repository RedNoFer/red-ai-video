const SYNCED_CANVAS_KEY = "vozeb-pro:canvas-drama-synced:";

export function markDramaCanvasSynced(canvasProjectId: string) {
    if (typeof window === "undefined" || !canvasProjectId) return;
    try {
        window.sessionStorage.setItem(`${SYNCED_CANVAS_KEY}${canvasProjectId}`, "1");
    } catch {
        // Storage can be unavailable in privacy-restricted browsers.
    }
}

export function consumeDramaCanvasSynced(canvasProjectId: string) {
    if (typeof window === "undefined" || !canvasProjectId) return false;
    const key = `${SYNCED_CANVAS_KEY}${canvasProjectId}`;
    try {
        if (window.sessionStorage.getItem(key) !== "1") return false;
        window.sessionStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}
