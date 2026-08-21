import React, { useEffect, useRef } from 'react';
import './index.css';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/layout/Sidebar';
import NotePanel from './components/notes/NotePanel';
import FloatingEye from './components/layout/FloatingEye';






import LicenseActivationModal from './components/license/LicenseActivationModal';



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
  const isLicensed = useAppStore(state => state.isLicensed);
  const setLicensed = useAppStore(state => state.setLicensed);








  const setIsTargetingMode = useAppStore(state => state.setIsTargetingMode);
  const sidebarWidth = useAppStore(state => state.sidebarWidth);
  const setPinnedWindowHwnd = useAppStore(state => state.setPinnedWindowHwnd);
  const isMac = useAppStore(state => state.isMac);
  const orientation = useAppStore(state => state.orientation);
  const screenBounds = useAppStore(state => state.screenBounds);


 const isHydrated = useAppStore(state => state.isHydrated);
  const notes = useAppStore(state => state.notes);
  const favorites = useAppStore(state => state.favorites);
  const noteSavePath = useAppStore(state => state.noteSavePath);

  // Apply fixed appearance: Amethyst theme + glass (style2) design.
  // Theme/design settings were removed from the UI, so these are hard-coded.
  useEffect(() => {
    if (!isHydrated) return; // Wait until store is ready from disk
    document.documentElement.setAttribute('data-theme', 'amethyst');
    document.documentElement.setAttribute('data-design', 'style2');
    // Keep the store in sync so internal UI (e.g. slider styles) uses glass style2.
    useAppStore.getState().setTheme?.('amethyst');
    useAppStore.getState().setDesign?.('style2');
  }, [isHydrated]);

  // Auto-sync notes to the configured save folder.
  // When a folder is set, immediately export every note; afterwards, debounce
  // 5 minutes after each edit, then re-export all notes (and drop files for
  // notes that were deleted).
  useEffect(() => {
    if (!isHydrated) return;
    if (!noteSavePath) return;

    const sync = () => {
      const st = useAppStore.getState();
      const noteList = st.notes
        .filter(n => !n.isSettings)
        .map(n => ({
          title: n.title,
          content: n.content,
          isSettings: false,
          isFavorite: st.favorites.some(f => f.id === n.id),
        }));
      window.api?.saveNotesToDir?.(noteSavePath, noteList)
        .then(res => {
          if (res && !res.success) {
            console.error('[NoteSync] failed:', res.reason);
          }
        })
        .catch(err => console.error('[NoteSync] error:', err));
    };

    // Sync immediately when the folder is first set / changed.
    sync();

    // Debounced re-sync 5 minutes after notes/favorites change.
    const timer = setTimeout(sync, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [isHydrated, noteSavePath, notes, favorites]);


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
        const ghostCenterX = window.api?.getGhostCenterSync?.().x ?? Math.floor(window.innerWidth / 2);
        useAppStore.getState().setMiniMode(true, { x: isMac ? Math.floor(window.innerWidth / 2) : ghostCenterX, y: Math.floor(visibleHeight / 2) });
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
    // Short interval also corrects click-through quickly after UI re-layout (e.g. panel
    // open/close or sidebar position change) without waiting for the next mousemove.
    const clickThroughTimer = setInterval(() => {
      reEvaluateClickThrough();
    }, 1500);
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
  // rAF coalescing: elementFromPoint is expensive, so run it at most once per frame
  const rafPending = useRef(false);

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

      if (rafPending.current) return;
      rafPending.current = true;
      requestAnimationFrame(() => {
        rafPending.current = false;
        const el = document.elementFromPoint(lastMouseX, lastMouseY);
        // If the target or any of its parents has pointer-events-auto, it is a solid UI element.
        // Otherwise, we consider it a transparent part of the ghost window.
        const isSolid = el ? el.closest('.pointer-events-auto') !== null : false;
        const isTransparent = !isSolid;
        // IPC Flood Protection: Only trigger main-process communication on pure state boundary crossings
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
      });
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
    </>
  );
};

export default App;
