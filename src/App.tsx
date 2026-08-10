import React, { useEffect, useRef } from 'react';
import '@tailwindcss/browser';
import './index.css';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/layout/Sidebar';
import NotePanel from './components/notes/NotePanel';
import FloatingEye from './components/layout/FloatingEye';






import LicenseActivationModal from './components/license/LicenseActivationModal';
import TutorialManager from './components/tutorial/TutorialManager';




// Global flag: when true, the ghost-window logic won't steal focus
// Exported so ResizerHandle can set it during drags
export let isResizingGlobal = false;

// Watchdog: if a drag/resize start is never followed by an end (e.g. mouseup
// fired outside the ghost window), the full-screen transparent window would
// swallow all clicks forever. Auto-recover after 15s.
let resizeWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
export function setIsResizingGlobal(v: boolean) {
    isResizingGlobal = v;
    if (v) {
        if (resizeWatchdogTimer) clearTimeout(resizeWatchdogTimer);
        resizeWatchdogTimer = setTimeout(() => {
            isResizingGlobal = false;
            resizeWatchdogTimer = null;
            reEvaluateClickThrough();
        }, 15000);
    } else {
        if (resizeWatchdogTimer) {
            clearTimeout(resizeWatchdogTimer);
            resizeWatchdogTimer = null;
        }
    }
}

// Track last cursor position so we can re-evaluate click-through after drag/resize ends
let lastMouseX = 0;
let lastMouseY = 0;

// Re-evaluate the transparent window's mouse click-through state at the current cursor.
// MUST be called after any drag/resize ends, otherwise the full-screen ghost window
// keeps swallowing all clicks when the mouse stays still.
export function reEvaluateClickThrough() {
    if (isResizingGlobal) return;
    const el = document.elementFromPoint(lastMouseX, lastMouseY);
    const isSolid = el ? el.closest('.pointer-events-auto') !== null : false;
    window.api?.setIgnoreMouseEvents(isSolid ? false : true);
}

// Set these flags for component-level feature toggling (managed by kobar-build.js)
export const IS_STORE_BUILD = true;
export const ENABLE_LICENSING = false;

const App: React.FC = () => {
  const edgePosition = useAppStore(state => state.edgePosition);

  const isNotePanelOpen = useAppStore(state => state.isNotePanelOpen);
  const isMiniMode = useAppStore(state => state.isMiniMode);
  const theme = useAppStore(state => state.theme);
  const isLicensed = useAppStore(state => state.isLicensed);
  const setLicensed = useAppStore(state => state.setLicensed);








  const setIsTargetingMode = useAppStore(state => state.setIsTargetingMode);
  const design = useAppStore(state => state.design);
  const sidebarWidth = useAppStore(state => state.sidebarWidth);
  const setPinnedWindowHwnd = useAppStore(state => state.setPinnedWindowHwnd);
  const isMac = useAppStore(state => state.isMac);
  const orientation = useAppStore(state => state.orientation);
  const screenBounds = useAppStore(state => state.screenBounds);

  const customThemeColor = useAppStore(state => state.customThemeColor);

 const isHydrated = useAppStore(state => state.isHydrated);
  const clipboardMonitoring = useAppStore(state => state.clipboardMonitoring);

  // Apply persisted theme/design on mount
  useEffect(() => {
    if (!isHydrated) return; // Wait until store is ready from disk

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-design', design);
    
    if (theme === 'custom' && customThemeColor) {
      const color = customThemeColor.startsWith('#') ? customThemeColor : `#${customThemeColor}`;
      const root = document.documentElement;
      
      const hexToHSL = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
      };

      const hslToHex = (h: number, s: number, l: number) => {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
          const k = (n + h / 30) % 12;
          const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
          return Math.round(255 * c).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
      };

      const { h, s } = hexToHSL(color);
      const { h: pH, s: pS, l: pL } = hexToHSL(color);
      root.style.setProperty('--theme-primary', color);
      root.style.setProperty('--theme-bg-dark', hslToHex(h, Math.min(s, 22), 8));
      root.style.setProperty('--theme-bg-base', hslToHex(h, Math.min(s, 22), 11));
      root.style.setProperty('--theme-bg-light', hslToHex(h, Math.min(s, 28), 96));
      root.style.setProperty('--theme-border', hslToHex(h, Math.min(s, 30), 22));
      root.style.setProperty('--theme-surface', hslToHex(h, Math.min(s, 22), 5));
      root.style.setProperty('--theme-accent-glow', `hsla(${pH}, ${pS}%, ${pL}%, 0.15)`);
      root.style.setProperty('--theme-scrollbar', hslToHex(h, Math.min(s, 30), 22));
      root.style.setProperty('--theme-marker', color);
    }
}, [theme, design, customThemeColor, isHydrated]);

  // Clipboard privacy: sync the monitoring toggle with the main-process listener
  useEffect(() => {
    if (!isHydrated) return;
    if (clipboardMonitoring) {
      window.api?.startClipboardListener?.();
    } else {
      window.api?.stopClipboardListener?.();
    }
  }, [isHydrated, clipboardMonitoring]);

// KoBox cleanup triggers
  useEffect(() => {
    window.api?.cleanKoBox?.(useAppStore.getState().koBoxCleanupMode);

    const handleBeforeUnload = () => {
      if (useAppStore.getState().koBoxCleanupMode === 'quit') {
        window.api?.cleanKoBox?.('quit');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!ENABLE_LICENSING) {
      setLicensed(true);
      return;
    }
    const storedKey = localStorage.getItem('kobar_license_key');
    if (storedKey) {
      setLicensed(true);
    }
  }, [setLicensed]);


  useEffect(() => {
    const unsubs: (() => void)[] = [];
    if (window.api?.getScreenBounds) {
      window.api.getScreenBounds().then(bounds => {
        if (bounds) useAppStore.getState().setScreenBounds(bounds);
      }).catch(err => console.error('Failed to get screen bounds:', err));
    }
    if (window.api?.onEdgeChanged) {
      window.api.onEdgeChanged((_edge, bounds) => {
        // Note: we intentionally do NOT overwrite edgePosition here.
        // The renderer's Sidebar drag logic owns edgePosition (based on the sidebar's
        // real screen position); the main-process edge event is only used to refresh bounds.
        if (bounds) useAppStore.getState().setScreenBounds(bounds);
      });
    }
    if (window.api?.onTeleportTriggered) {
      unsubs.push(window.api.onTeleportTriggered((pos) => {
        useAppStore.getState().setMiniMode(true, pos);
      }));
    }
    if (window.api?.onPinnedWindowChanged) {
      unsubs.push(window.api.onPinnedWindowChanged((hwnd) => {
        setPinnedWindowHwnd(hwnd);
      }));
    }
    if (window.api?.onForceCenterMiniMode) {
      unsubs.push(window.api.onForceCenterMiniMode(() => {
        const screenBounds = useAppStore.getState().screenBounds;
        const visibleHeight = screenBounds?.height ?? 800;
        const isMac = useAppStore.getState().isMac;
        // Vertically center it inside the visible screen bounds (Y=0 is top of screen)
        useAppStore.getState().setMiniMode(true, { x: isMac ? Math.floor(window.innerWidth / 2) : 3000, y: Math.floor(visibleHeight / 2) });
      }));
    }
    if (window.api?.onResetUiPosition) {
      // Window was moved externally (teleport/tray/system). Reset the floating position so the
      // sidebar/panel DOM coordinates realign with the new window position, and re-evaluate
      // click-through so the ghost window never stays stuck swallowing clicks.
      unsubs.push(window.api.onResetUiPosition(() => {
        const st = useAppStore.getState();
        if (isResizingGlobal || st.isDraggingGlobal) return; // skip during active drag/resize
        st.setSidebarPosition(null);
        reEvaluateClickThrough();
      }));
    }

    // Self-healing: periodically re-evaluate click-through at the last known cursor position.
    // Fixes the "UI becomes transparent after ~1h" scenario where no mousemove event arrives
    // to flip the ignore-mouse state back after a monitor sleep / external window move.
    const clickThroughTimer = setInterval(() => {
      reEvaluateClickThrough();
    }, 60000);
    unsubs.push(() => clearInterval(clickThroughTimer));
    if (window.api?.onOpenSettings) {
      unsubs.push(window.api.onOpenSettings(() => {
        useAppStore.getState().setMiniMode(false);
        useAppStore.getState().openSettingsTab();
      }));
    }
    if (window.api?.onPinTargetingComplete) {
      unsubs.push(window.api.onPinTargetingComplete(() => {
        setIsTargetingMode(false);
      }));
    }


    // KoPlayer: Subscribe to media updates from the main process
    if (window.api?.onMediaUpdate) {
      unsubs.push(window.api.onMediaUpdate((data) => {
        useAppStore.getState().setCurrentMedia(data);
        useAppStore.getState().setCurrentMediaSourceApp((data?.sourceAppId || '').toLowerCase());
      }));
    }

    // Video PiP: Subscribe to background-scanned video URL cache
    if (window.api?.onVideoUrlsUpdate) {
      unsubs.push(window.api.onVideoUrlsUpdate((urls) => {
        useAppStore.getState().setActiveVideoUrls(urls);
      }));
    }

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, []);

  // Persist tracking across any possible re-renders without falling out of scope
  const lastIgnoreState = useRef<boolean | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      // If we are currently resizing the UI, ALWAYS KEEP MOUSE EVENTS ACTIVE. 
      // Do not allow the OS to steal the mouseup event through the ghost window.
      if (isResizingGlobal) {
        if (lastIgnoreState.current !== false) {
          window.api?.setIgnoreMouseEvents(false);
          lastIgnoreState.current = false;
        }
        return;
      }

      const target = e.target as HTMLElement;
      
      // If the target or any of its parents has pointer-events-auto, it is a solid UI element.
      // Otherwise, we consider it a transparent part of the ghost window.
      const isSolid = target.closest('.pointer-events-auto') !== null;
      const isTransparent = !isSolid;

      // IPC Flood Protection: Only trigger Electron main process communication linearly on pure state boundary crossings
      if (isTransparent !== lastIgnoreState.current) {
        const isMacLocal = useAppStore.getState().isMac;
        if (isMacLocal) {
          requestAnimationFrame(() => {
            window.api?.setIgnoreMouseEvents(isTransparent);
          });
        } else {
          window.api?.setIgnoreMouseEvents(isTransparent);
        }
        lastIgnoreState.current = isTransparent;
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const sidebarPosition = useAppStore(state => state.sidebarPosition);

  return (
    <>
      <div 
        className={`relative w-full h-full pointer-events-none flex ${
          sidebarPosition 
            ? 'items-start pt-[20px]' /* Free floating: default placement */
            : (orientation === 'horizontal'
                ? (edgePosition === 'top' ? 'items-start justify-center pt-0' : 'items-end justify-center pb-0')
                : (isMac 
                    ? (edgePosition === 'left' ? 'items-start justify-start pt-[20px]' : 'items-start justify-end pt-[20px]')
                    : 'items-start justify-center pt-[20px]'))
        }`}
        style={{
          transform: `translate(0px, 0px)`
        }}
      >
        <div 
          id="kobar-sidebar-wrapper"
          className={`relative pointer-events-auto shrink-0 transition-opacity duration-300 ${isMiniMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{ 
            width: orientation === 'horizontal' ? 'fit-content' : `${sidebarWidth}px`, 
            height: orientation === 'horizontal' ? `${sidebarWidth}px` : 'fit-content',
            zIndex: 30,
            ...(sidebarPosition 
              ? { position: 'absolute' as const, left: sidebarPosition.x, top: sidebarPosition.y } 
              : (orientation === 'horizontal'
                  ? { 
                      position: 'absolute' as const, 
                      left: '50%', 
                      transform: 'translateX(-50%)', 
                      top: edgePosition === 'top' ? 0 : `${(screenBounds?.height ?? window.innerHeight) - sidebarWidth}px` 
                    }
                  : {})
            )
          }}>
          <Sidebar />
          {!isMiniMode && (
            <>
              {isLicensed && isNotePanelOpen && edgePosition === 'left' && (
                <div className="absolute top-0 pointer-events-none" style={{ left: '100%', zIndex: 20 }}>
                  <NotePanel />
                </div>
              )}
              {isLicensed && isNotePanelOpen && edgePosition === 'right' && (
                <div className="absolute top-0 pointer-events-none" style={{ right: '100%', zIndex: 20 }}>
                  <NotePanel />
                </div>
              )}
              {isLicensed && isNotePanelOpen && edgePosition === 'top' && (
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none pt-2" style={{ top: '100%', zIndex: 20 }}>
                  <NotePanel />
                </div>
              )}
              {isLicensed && isNotePanelOpen && edgePosition === 'bottom' && (
                <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none pb-2" style={{ bottom: '100%', zIndex: 20 }}>
                  <NotePanel />
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {isMiniMode && <FloatingEye />}

      {!IS_STORE_BUILD && !isLicensed && (
        <LicenseActivationModal onSuccess={() => setLicensed(true)} />
      )}

      <TutorialManager />
    </>
  );
};

export default App;
