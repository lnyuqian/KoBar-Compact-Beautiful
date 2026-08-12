import { screen } from 'electron';

// ─── Ghost Window Geometry ────────────────────────────────────────────────
// The invisible "ghost" window is sized to the union of every display so the
// transparent window spans all monitors while keeping GPU/compositor cost low.

// Fallback size used only if no displays are reported by the OS.
export const GHOST_WINDOW_WIDTH = 6000;
export const GHOST_WINDOW_HEIGHT = 4000;

// Initial visual sidebar rectangle; the renderer keeps it in sync via updateSidebarRect.
export const DEFAULT_SIDEBAR_RECT = { width: 80, height: 600, offsetX: 1660, offsetY: 20 };

// Distance from the right edge of the ghost window to the default sidebar position.
export const SIDEBAR_EDGE_MARGIN = 40;

// Returns the bounding box that covers every display's workArea.
export function getGhostBounds(): { x: number; y: number; width: number; height: number } {
    const displays = screen.getAllDisplays();
    if (displays.length === 0) {
        return { x: 0, y: 0, width: GHOST_WINDOW_WIDTH, height: GHOST_WINDOW_HEIGHT };
    }
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const d of displays) {
        const wa = d.workArea;
        minX = Math.min(minX, wa.x);
        minY = Math.min(minY, wa.y);
        maxX = Math.max(maxX, wa.x + wa.width);
        maxY = Math.max(maxY, wa.y + wa.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Center of the ghost window in window-relative coordinates.
export function getGhostCenter(): { x: number; y: number } {
    // The window is anchored to the primary display, so its center is exactly
    // half of the primary workArea -- valid at any resolution/display layout.
    const primary = screen.getPrimaryDisplay();
    const wa = primary.workArea;
    return { x: wa.width / 2, y: wa.height / 2 };
}
