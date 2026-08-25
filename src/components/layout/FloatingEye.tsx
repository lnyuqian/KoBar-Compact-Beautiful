import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { setIsResizingGlobal, reEvaluateClickThrough } from '../../App';
import alienOpen from '../../assets/alien-open.png';
import alienClosed from '../../assets/alien-closed.png';

// The main process sizes the ghost window to the union of all displays and
// exposes its center via a synchronous IPC call. The window size is stable for
// the app session, so the result is cached after the first read.
let cachedGhostCenter: { x: number; y: number } | null = null;
function getGhostCenter(): { x: number; y: number } {
    if (cachedGhostCenter) return cachedGhostCenter;
    try {
        cachedGhostCenter = window.api?.getGhostCenterSync?.() ?? { x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) };
    } catch {
        cachedGhostCenter = { x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) };
    }
    return cachedGhostCenter;
}
function getGhostWidth(): number {
    return getGhostCenter().x * 2;
}

// Alien skin sizing: the source art is 100x142. Displayed at 115px wide it is
// 2.4x the original 48px puck footprint and 1.2x the 96px iteration (height
// follows ratio).
const ALIEN_W = 115;
const ALIEN_H = Math.round(115 * 142 / 100); // 163

const FloatingEye: React.FC = () => {
    const edgePosition = useAppStore(state => state.edgePosition);
    const miniModePosition = useAppStore(state => state.miniModePosition);
    const iconScale = useAppStore(state => state.iconScale);
    const screenBounds = useAppStore(state => state.screenBounds);
    const isMiniMode = useAppStore(state => state.isMiniMode);

    // Calculate safe fallback coordinates using actual monitor dimensions.
    // The ghost window is 6000×4000, but the visible area matches `screenBounds`.
    // Using window.innerWidth/Height (6000/4000) would place the Eye at Y=2000,
    // far off-screen on most monitors. Instead, use screenBounds as the sizing reference.
    const visibleH = screenBounds?.height ?? 800;
    const visibleW = screenBounds?.width ?? 1920;

    // For X: place the Eye near the current edge within the visible viewport.
    // The sidebar is centered in the ghost window via CSS justify-center,
    // so its left offset ≈ (6000 - sidebarWidth) / 2.
    // For the fallback, stay near the sidebar's edge:
    // left edge → slightly inward from the sidebar's expected CSS position
    // right edge → slightly inward from the other side
    const isMac = useAppStore(state => state.isMac);
    const centerX = isMac ? Math.floor(window.innerWidth / 2) : getGhostCenter().x;
    const safeDefaultX = edgePosition === 'left'
        ? (centerX - visibleW / 2 + 60)   // Near left edge of visible area within ghost window
        : (centerX + visibleW / 2 - 60);  // Near right edge of visible area within ghost window

    // For Y: the sidebar starts at CSS top ≈ 20px. Place the Eye at the
    // vertical center of the visible monitor area, referenced from that origin.
    const safeDefaultY = 20 + (visibleH / 2);

    const defaultX = miniModePosition?.x ?? safeDefaultX;
    const defaultY = miniModePosition?.y ?? safeDefaultY;

    const [pos, setPos] = useState({ x: defaultX, y: defaultY });
    const posRef = useRef({ x: defaultX, y: defaultY });
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isDev, setIsDev] = useState(false);
    const dragInitRef = useRef({ dragged: false, offsetX: 0, offsetY: 0 });
    const windowPosRef = useRef({ x: 0, y: 0 });
    const localDisplaysRef = useRef<{ primaryDisplay: any, allDisplays: any[] } | null>(null);

    // If teleport is triggered while already in Mini Mode, update pos to the new cursor center
    useEffect(() => {
        if (miniModePosition) {
            setPos({ x: miniModePosition.x, y: miniModePosition.y });
            posRef.current = { x: miniModePosition.x, y: miniModePosition.y };
        }
    }, [miniModePosition]);

    useEffect(() => {
        if (window.api?.isDev) {
            window.api.isDev().then(setIsDev).catch(console.warn);
        }
    }, []);

    // Hit-test zones on the alien art (normalized 0..1 over the displayed box):
    //   - hair region (top ~34%): drag handle
    //   - eye zone (center, deliberately enlarged for easy hitting): toggle
    //     collapse/expand. Only the eye toggles — the ears/face do nothing.
    const hitZone = (e: React.MouseEvent): 'hair' | 'eye' | 'none' => {
        const el = containerRef.current;
        if (!el) return 'none';
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return 'none';
        const rx = (e.clientX - rect.left) / rect.width;
        const ry = (e.clientY - rect.top) / rect.height;
        if (ry < 0.34) return 'hair';
        if (ry >= 0.30 && ry < 0.80 && rx >= 0.20 && rx <= 0.80) return 'eye';
        return 'none';
    };

    const togglePanel = () => {
        const st = useAppStore.getState();
        const goingMini = !st.isMiniMode;
        // Expand shows the content panel (notes); collapse hides it. The ear-click
        // toggle logic was merged here: clicking the eye now owns both directions.
        st.setNotePanelOpen(!goingMini);
        st.setMiniMode(goingMini, { x: posRef.current.x, y: posRef.current.y });
        // Re-evaluate mouse click-through immediately: toggling re-lays out the UI,
        // so the ignore-mouse state must be refreshed right away instead of waiting
        // for the next mousemove. Double rAF waits for React to commit the change.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => reEvaluateClickThrough());
        });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        const zone = hitZone(e);

        // The eye zone toggles the content panel (collapsed ⇄ expanded).
        if (zone === 'eye') {
            e.preventDefault();
            togglePanel();
            return;
        }
        // Only the hair region starts a drag.
        if (zone !== 'hair') return;

        e.preventDefault(); // Prevent text selection during drag
        setIsDragging(true);
        setIsResizingGlobal(true); // Prevent transparent click-through issues globally
        useAppStore.getState().setIsDraggingGlobal(true);
        dragInitRef.current = {
            dragged: false,
            offsetX: e.clientX - posRef.current.x,
            offsetY: e.clientY - posRef.current.y,
        };

        // Fetch display info and window position
        if (window.api?.getDisplaysInfo) {
            window.api.getDisplaysInfo().then(info => {
                localDisplaysRef.current = info;
            }).catch(err => console.warn('IPC getDisplaysInfo not ready:', err));
        }
        if (window.api?.getWindowPositionSync) {
            const [wx, wy] = window.api.getWindowPositionSync();
            windowPosRef.current = { x: wx, y: wy };
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            let mouseX = e.clientX;
            let mouseY = e.clientY;

            // Physical cursor position
            const physicalCursorX = windowPosRef.current.x + mouseX;
            const physicalCursorY = windowPosRef.current.y + mouseY;

            // Find if we crossed display boundary
            if (localDisplaysRef.current && !isMac) {
                const allDisplays = localDisplaysRef.current.allDisplays;
                const activeDisplay = allDisplays.find(d => 
                    physicalCursorX >= d.bounds.x && physicalCursorX < (d.bounds.x + d.bounds.width) &&
                    physicalCursorY >= d.bounds.y && physicalCursorY < (d.bounds.y + d.bounds.height)
                );

                if (activeDisplay) {
                    const windowWidth = getGhostWidth();
                    const newWinX = Math.floor(activeDisplay.workArea.x + (activeDisplay.workArea.width / 2) - (windowWidth / 2));
                    const newWinY = activeDisplay.workArea.y;

                    if (newWinX !== windowPosRef.current.x || newWinY !== windowPosRef.current.y) {
                        const dx = newWinX - windowPosRef.current.x;
                        const dy = newWinY - windowPosRef.current.y;

                        // Move the window
                        window.api?.moveWindow(dx, dy);

                        // Update local window position ref
                        windowPosRef.current = { x: newWinX, y: newWinY };

                        // Adjust last values and DOM positions
                        posRef.current.x -= dx;
                        posRef.current.y -= dy;
                        
                        if (containerRef.current) {
                            containerRef.current.style.left = `${posRef.current.x}px`;
                            containerRef.current.style.top = `${posRef.current.y}px`;
                        }

                        // Adjust local event mouse coords for calculations below
                        mouseX -= dx;
                        mouseY -= dy;
                    }
                }
            }

            const newX = mouseX - dragInitRef.current.offsetX;
            const newY = mouseY - dragInitRef.current.offsetY;

            const dx = newX - posRef.current.x;
            const dy = newY - posRef.current.y;

            // If moved more than 0.5px, consider it a drag so we don't trigger click
            if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                dragInitRef.current.dragged = true;
            }

            // Fast DOM manipulation to bypass React rendering during drag
            posRef.current = { x: newX, y: newY };
            if (containerRef.current) {
                containerRef.current.style.left = `${newX}px`;
                containerRef.current.style.top = `${newY}px`;
            }

            // Drag the expanded content panel in lockstep so it follows the alien
            // in real time (no jump on release). The panel is only visible when
            // expanded, so skip this while in mini mode.
            if (!useAppStore.getState().isMiniMode && (dx !== 0 || dy !== 0)) {
                const wrapper = document.getElementById('kobar-sidebar-wrapper');
                if (wrapper) {
                    const curLeft = parseFloat(wrapper.style.left || '0');
                    const curTop = parseFloat(wrapper.style.top || '0');
                    wrapper.style.left = `${curLeft + dx}px`;
                    wrapper.style.top = `${curTop + dy}px`;
                }
            }
        };

        const handleMouseUp = async () => {
            if (isDragging) {
                setIsDragging(false);
                setIsResizingGlobal(false);
                useAppStore.getState().setIsDraggingGlobal(false);
                reEvaluateClickThrough();

                if (dragInitRef.current.dragged) {
                    let finalPos = { x: posRef.current.x, y: posRef.current.y };
                    if (window.api?.recenterWindowOnWidget && !isMac) {
                        const result = await window.api.recenterWindowOnWidget(finalPos.x, finalPos.y, ALIEN_W, ALIEN_H);
                        if (result) {
                            finalPos = { x: result.x, y: result.y };
                        }
                    }

                    // Re-sync React state once drag completes
                    setPos(finalPos);
                    // Persist the final position, keeping the current collapse state
                    // (dragging while expanded re-aligns the panel next to the alien).
                    useAppStore.getState().setMiniMode(useAppStore.getState().isMiniMode, finalPos);
                }
            }
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Skin: closed eye = panel collapsed (mini mode), open eye = panel expanded.
    // Matches the previous logic where the closed-eye puck was shown while collapsed.
    const alienSrc = isMiniMode ? alienClosed : alienOpen;

    return (
        <div
            ref={containerRef}
            className="fixed z-[999] pointer-events-auto"
            style={{ left: pos.x, top: pos.y, transform: `translate(-50%, -50%) scale(${iconScale})`, transformOrigin: 'center center' }}
            onMouseDown={handleMouseDown}
        >
            <div className="relative select-none" style={{ width: ALIEN_W, height: ALIEN_H }}>
                <img
                    src={alienSrc}
                    alt={isMiniMode ? 'KoBar 外星人（闭眼）' : 'KoBar 外星人（睁眼）'}
                    draggable={false}
                    className="pointer-events-none absolute inset-0 w-full h-full"
                    style={{ objectFit: 'contain' }}
                />
                {/* Drag handle: hair region (top) — cursor shows grab */}
                <div
                    className="absolute inset-x-0 top-0 cursor-grab active:cursor-grabbing"
                    style={{ height: '34%' }}
                />
                {/* Toggle zone: eye area (center, enlarged) — cursor shows pointer */}
                <div
                    className="absolute cursor-pointer"
                    style={{ left: '20%', top: '30%', width: '60%', height: '50%' }}
                />
                {isDev && (
                    <span className="absolute -top-1 -right-1 z-[1000] bg-orange-500 text-black text-[9px] font-extrabold px-1 py-0.5 rounded-sm border border-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.6)] select-none pointer-events-none tracking-wide scale-90 origin-top-right uppercase leading-none font-sans">
                        dev
                    </span>
                )}
            </div>
        </div>
    );
};

export default FloatingEye;
