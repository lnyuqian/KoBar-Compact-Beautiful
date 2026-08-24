import { app, BrowserWindow, Tray, Menu, MenuItem, ipcMain, screen, nativeImage, clipboard, globalShortcut, shell, dialog, session, WebContents, desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec, execFile, ChildProcess } from 'child_process';
import { LicenseManager } from './licenseManager.cjs';
import AdmZip from 'adm-zip';
import {
    GHOST_WINDOW_WIDTH,
    GHOST_WINDOW_HEIGHT,
    DEFAULT_SIDEBAR_RECT,
    SIDEBAR_EDGE_MARGIN,
    getGhostBounds,
    getGhostCenter
} from './window-geometry.cjs';
import { createTray } from './tray.cjs';


const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isDev = !app.isPackaged;

if (isDev) {
    app.setName('KoBarDev');
    app.setPath('userData', path.join(app.getPath('appData'), 'KoBarDev'));
}

const systemConfigPath = path.join(app.getPath('userData'), 'kobar-system.json');

// GPU is MANDATORY for transparent windows in modern Electron.
// Any attempt to disable it results in an invisible (black) window.
function getSystemConfig() {
    return { hardwareAcceleration: true };
}

console.log("[SYS] Hardware Acceleration: FORCED ENABLED");

// SURGICAL FIX FOR VIDEO BLACKOUT & OCCLUSION
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,WindowOcclusion,HardwareMediaKeyHandling,MediaSessionService');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const windowStatePath = path.join(app.getPath('userData'), 'window-state.json');


let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentEdge: string = 'left';
let psProcess: ChildProcess | null = null;
let isGlobalPasteModeActive = false;
let isAwaitingPinTarget = false;
let sidebarRect = { ...DEFAULT_SIDEBAR_RECT };
let teleportShortcutKey = '';
let borderWindow: BrowserWindow | null = null;
let preEyeDropperBounds: { x: number; y: number; width: number; height: number; } | null = null;
let isEyeDropperActive = false;

let trackingInterval: NodeJS.Timeout | null = null;
let pinnedHwnd: number | null = null;
let allPinnedHwnds: Set<number> = new Set();

// Pinned-window border tracking — serialized request/response over the long-lived
// PowerShell process. The old loop polled every 50ms and attached its reply
// listener to stdin (a Writable stream that never emits 'data'), so every query
// went unanswered while the PS host was hammered with 20 queries/sec — a major
// dev-mode lag source. Now:
//   - 250ms cadence (>= 200ms as required) instead of 50ms;
//   - replies are read from STDOUT with line buffering;
//   - only one query is in flight at a time, with an idle timeout so a lost or
//     swallowed reply (e.g. a stray PS warning) can never stall the chain.
const WINDOW_TRACK_POLL_MS = 250;
let windowTrackInFlight = false;
let windowTrackOutBuffer = '';
let windowTrackIdleTimer: NodeJS.Timeout | null = null;

// Set these flags for feature toggling (managed by kobar-build.js)
const IS_STORE_BUILD = true;

// Set Application User Model ID to fix Windows Taskbar, Notifications, and Task Manager Startup icons
const AUMID = isDev ? 'com.eedali.kobar.dev' : 'com.eedali.kobar';
app.setAppUserModelId(AUMID);

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            // Teleport to primary display center instead of just showing
            teleportToPrimaryCenter();
        }
    });
}

function createWindow() {
    let savedState: { x: number, y: number } | null = null;
    try {
        if (fs.existsSync(windowStatePath)) {
            savedState = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'));
        }
    } catch (e) {
        console.error('Could not load window state', e);
    }

    // Single-screen mode: anchor the window to the primary display workArea.
    // This intentionally ignores any secondary/virtual displays so the ghost
    // window never lands off-screen when a monitor is disconnected.
    const primary = screen.getPrimaryDisplay();

    // Default sidebar position: docked to the right edge of the primary display.
    const defaultSidebarRight = primary.workArea.x + primary.workArea.width - SIDEBAR_EDGE_MARGIN;
    sidebarRect.offsetX = defaultSidebarRight - primary.workArea.x - sidebarRect.width;
    sidebarRect.offsetY = 20;

    // Mac: use `bounds` (full screen incl. menu bar + Dock area) instead of `workArea`.
    // This prevents macOS from clipping the transparent window at the Dock boundary.
    const macScreen = isMac ? primary.bounds : primary.workArea;
    const winWidth = isMac ? macScreen.width : primary.workArea.width;
    const winHeight = isMac ? macScreen.height : primary.workArea.height;
    const winX = isMac ? macScreen.x : primary.workArea.x;
    const winY = isMac ? macScreen.y : primary.workArea.y;

    mainWindow = new BrowserWindow({
        x: winX,
        y: winY,
        width: winWidth,
        height: winHeight,
        minWidth: winWidth,
        minHeight: winHeight,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // Explicit transparent alpha channel to fix Windows DWM occlusion blurring
        alwaysOnTop: true,
        skipTaskbar: true,
        type: (isWin ? 'toolbar' : 'panel') as 'toolbar', // Win: toolbar (DWM throttle fix) | Mac: panel (NSPanel, floats above Dock)
        resizable: false,
        maximizable: false,
        enableLargerThanScreen: isWin,
        hasShadow: isMac ? false : true, // Mac: prevent native shadow being cast on invisible transparent divs (ghost stroke)
        icon: path.join(__dirname, '../build/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (isWin) {
        mainWindow.setMinimumSize(winWidth, winHeight);
        mainWindow.setMaximumSize(Math.max(winWidth * 2, 4000), Math.max(winHeight * 3, 4000));
        mainWindow.setSize(winWidth, winHeight);
    } else if (isMac) {
        mainWindow.setMinimumSize(winWidth, winHeight);
        mainWindow.setSize(winWidth, winHeight);
    }
    // Win: screen-saver (highest DWM level) | Mac: floating (above Dock, below TCC prompts)
    mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
    if (isMac) {
        // Ensure KoBar stays above Dock, Mission Control overlays, and full-screen apps on macOS
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
        mainWindow.setAlwaysOnTop(true, 'floating', 1); // re-enforce after workspace registration
    }
    mainWindow.setIgnoreMouseEvents(true, { forward: true });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Edge detection 鈥?fires during drag for smooth real-time updates
    mainWindow.on('move', () => {
        if (isEyeDropperActive) return;
        handleWindowMove();
    });

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            const loginSettings = app.getLoginItemSettings();
            const isHidden = process.argv.includes('--hidden') || loginSettings.wasOpenedAtLogin;

            // Teleport to center on fresh boot and force Mini Mode (pass showWindow flag based on args)
            teleportToPrimaryCenter(!isHidden);

            if (!isHidden) {
                mainWindow.show();
            }
            mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
            if (isMac) {
                // Re-enforce workspace visibility after window is fully loaded
                mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                mainWindow.setAlwaysOnTop(true, 'floating', 1);
            }
            handleWindowMove(true);

            // Dispatch forcing Mini Mode right after load
            mainWindow.webContents.send('force-center-mini-mode');
        }
    });

    let saveBoundsTimeout: ReturnType<typeof setTimeout>;
    let lastResetSentAt = 0;
    mainWindow.on('move', () => {
        if (isEyeDropperActive) return;
        clearTimeout(saveBoundsTimeout);
        saveBoundsTimeout = setTimeout(async () => {
            if (!mainWindow) return;
            const [x, y] = mainWindow.getPosition();
            try {
                await fs.promises.writeFile(windowStatePath, JSON.stringify({ x, y }));
            } catch (err) {
                console.error('Failed to save window state:', err);
            }
        }, 500);

        // Window moved (external or system-triggered): tell the frontend to re-sync its
        // floating position and click-through state. Throttled so drag-driven moves
        // (which the renderer manages itself) don't cause churn.
        const now = Date.now();
        if (now - lastResetSentAt > 500) {
            lastResetSentAt = now;
            mainWindow?.webContents.send('reset-ui-position');
        }
    });

    // Re-enforce Always on Top when losing focus to taskbar
    mainWindow.on('blur', () => {
        if (!isAwaitingPinTarget && mainWindow) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        }
    });

    // Handle Context Menu for Copy/Paste in Notes
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = new Menu();
        
        if (params.isEditable) {
            menu.append(new MenuItem({ label: '撤销', role: 'undo' }));
            menu.append(new MenuItem({ label: '重做', role: 'redo' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: '剪切', role: 'cut' }));
            menu.append(new MenuItem({ label: '复制', role: 'copy' }));
            menu.append(new MenuItem({ label: '粘贴', role: 'paste' }));
            menu.append(new MenuItem({ type: 'separator' }));
            menu.append(new MenuItem({ label: '全选', role: 'selectAll' }));
        } else if (params.selectionText && params.selectionText.trim() !== '') {
            menu.append(new MenuItem({ label: '复制', role: 'copy' }));
        }
        
        if (menu.items.length > 0) {
            menu.popup({ window: mainWindow! });
        }
    });
}

function handleWindowMove(force = false) {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    const [width] = mainWindow.getSize();
    // Judge the edge by the sidebar panel's REAL screen position (ghost window offset),
    // not the 6000px-wide ghost window center (which is always ~3000 鈫?always 'right').
    const sidebarScreenCenter = x + sidebarRect.offsetX + (sidebarRect.width / 2);
    const activeDisplay = screen.getDisplayNearestPoint({ x: sidebarScreenCenter, y: 100 });
    const bounds = activeDisplay.workArea;
    const newEdge = sidebarScreenCenter > (bounds.x + bounds.width / 2) ? 'right' : 'left';

    if (force || newEdge !== currentEdge) {
        currentEdge = newEdge;
        mainWindow.webContents.send('edge-changed', newEdge, bounds);
        console.log(`Edge changed to: ${newEdge}`);
    }

    if (sidebarRect.width > 0) {
        let newX = x;
        let newY = y;
        let clamped = false;

        const visLeft = x + sidebarRect.offsetX;
        const visRight = visLeft + sidebarRect.width;
        const visTop = y + sidebarRect.offsetY;
        const visBottom = visTop + sidebarRect.height;

        if (visLeft < bounds.x) { newX = bounds.x - sidebarRect.offsetX; clamped = true; }
        if (visRight > bounds.x + bounds.width) { newX = bounds.x + bounds.width - sidebarRect.width - sidebarRect.offsetX; clamped = true; }
        if (visTop < bounds.y) { newY = bounds.y - sidebarRect.offsetY; clamped = true; }
        if (visBottom > bounds.y + bounds.height) { newY = bounds.y + bounds.height - sidebarRect.height - sidebarRect.offsetY; clamped = true; }

        // Kullan谋c谋n谋n pencereyi istedi臒i yere 枚zg眉rce ta艧谋yabilmesi i莽in 
        // ekrandan ta艧ma (clamping) k谋s谋tlamas谋n谋 devre d谋艧谋 b谋rakt谋k.
        // if (clamped) {
        //     mainWindow.setPosition(Math.round(newX), Math.round(newY));
        // }
    }
}

// Returns the ghost window position. The ghost window is sized to the union of
// all displays, so its position is simply the top-left corner of that union.
// Used on launch fallback and tray show.
function calculatePrimaryCenterPosition(): { x: number; y: number } {
    const primary = screen.getPrimaryDisplay();
    const wa = primary.workArea; // { x, y, width, height } in OS coords

    // Always anchor to the primary display's workArea top-left corner.
    // Using the ghost-bounds corner here can place the window off-screen
    // when the display union includes a disconnected/virtual monitor.
    return { x: wa.x, y: wa.y };
}

function teleportToPrimaryCenter(showWindow = true) {
    if (!mainWindow) return;

    const pos = calculatePrimaryCenterPosition();
    mainWindow.setPosition(pos.x, pos.y);

    if (showWindow) {
        mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        mainWindow.focus();
    }

    // Re-detect edge and send updated screen bounds to the frontend
    handleWindowMove(true);

    // The window was moved externally; tell the frontend to reset its floating
    // position so the visual UI and the actual click targets stay aligned.
    mainWindow.webContents.send('reset-ui-position');

    // Force the frontend to reset to Mini Mode and position perfectly at the center
    mainWindow.webContents.send('force-center-mini-mode');
}



app.whenReady().then(() => {
    // Ensure KoBox exists
    const koBoxPath = path.join(app.getPath('userData'), 'KoBox');
    if (!fs.existsSync(koBoxPath)) {
        fs.mkdirSync(koBoxPath, { recursive: true });
    }

    if (isWin) {
        // We use spawn for powershell here but for macOS we don't need persistent child process
        const spawn = require('child_process').spawn;
        psProcess = spawn('powershell', ['-NoProfile', '-Command', '-']);
        psProcess?.stdin?.write(`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class K { [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, uint dwExtraInfo); [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags); [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex); [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect); [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; } }'\n`);
    }

    createWindow();
    tray = createTray({
        getWindow: () => mainWindow,
        onTeleport: teleportToPrimaryCenter
    });

    // Handle microphone permissions explicitly for voice-to-text
    session.defaultSession.setPermissionCheckHandler((_webContents: WebContents | null, permission: string) => {
        if (permission === 'audioCapture') return true;
        return false;
    });

    session.defaultSession.setPermissionRequestHandler((_webContents: WebContents, permission: string, callback: (granted: boolean) => void) => {
        if (permission === 'audioCapture') {
            callback(true);
        } else {
            callback(false);
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    app.on('will-quit', () => {
        globalShortcut.unregisterAll();
        if (psProcess) psProcess.kill();
    });

    app.on('browser-window-blur', (event, window) => {
        if (isAwaitingPinTarget && window === mainWindow) {
            isAwaitingPinTarget = false;
            // Wait 200ms for the OS to fully focus the new third-party window
            setTimeout(() => {
                if (isWin) {
                    const psPinScript = `
                    $hwnd = [K]::GetForegroundWindow()
                    $GWL_EXSTYLE = -20
                    $WS_EX_TOPMOST = 0x0008
                    $HWND_TOPMOST = -1
                    $HWND_NOTOPMOST = -2
                    
                    $exStyle = [K]::GetWindowLong($hwnd, $GWL_EXSTYLE)
                    if (($exStyle -band $WS_EX_TOPMOST) -eq $WS_EX_TOPMOST) {
                        # Already TopMost, so UNPIN it
                        [K]::SetWindowPos($hwnd, $HWND_NOTOPMOST, 0, 0, 0, 0, 3)
                        Write-Output "UNPINNED:$hwnd"
                    } else {
                        # Not TopMost, so PIN it
                        [K]::SetWindowPos($hwnd, $HWND_TOPMOST, 0, 0, 0, 0, 3)
                        Write-Output "PINNED:$hwnd"
                    }
                    `;
                    if (psProcess && psProcess.stdout) {
                        psProcess.stdout.once('data', (data: Buffer) => {
                            const output = data.toString();
                            if (output.includes('PINNED:')) {
                                const hwnd = parseInt(output.split('PINNED:')[1].trim());
                                allPinnedHwnds.add(hwnd);
                                startWindowTracking(hwnd);
                            } else if (output.includes('UNPINNED:')) {
                                const hwnd = parseInt(output.split('UNPINNED:')[1].trim());
                                allPinnedHwnds.delete(hwnd);
                                if (pinnedHwnd === hwnd) stopWindowTracking();
                            }
                        });
                        psProcess.stdin!.write(psPinScript + '\n');
                    }
                } else if (isMac) {
                    if (mainWindow) {
                        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                        pinnedHwnd = 1; // Fake truthy value for macOS to signify pinned status
                        mainWindow.webContents.send('pin-targeting-complete');
                    }
                }
                if (isWin) mainWindow?.webContents.send('pin-targeting-complete');
            }, 200);
        }
    });

});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC listeners
ipcMain.on('hide-app', () => {
    if (mainWindow) {
        mainWindow.hide();
    }
});

ipcMain.on('quit-app', () => {
    app.quit();
});

ipcMain.handle('save-note-as-text', async (event, { title, content, savePath, isFavorite }) => {
    console.log('[SaveNote] title=' + title + ' savePath=' + savePath + ' fav=' + isFavorite);
    if (!mainWindow) return { success: false, reason: 'No main window' };

    // Sanitize title for filename; append a suffix when the note is favorited
    // Favorited notes get a heart symbol in the filename (NTFS-safe).
    const baseTitle = (title || 'note').replace(/[^a-z0-9一-鿿]/gi, '_');
    const safeTitle = isFavorite ? baseTitle + '♥' : baseTitle;

    try {
        // When a save folder is configured, save directly (no dialog).
        if (savePath) {
            const filePath = path.join(savePath, `${safeTitle || 'note'}.txt`);
            await fs.promises.writeFile(filePath, content, 'utf8');
            return { success: true, path: filePath };
        }

        // No save folder configured: fall back to a save dialog.
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: '将笔记另存为文本',
            defaultPath: `${safeTitle || 'note'}.txt`,
            filters: [
                { name: '文本文件', extensions: ['txt'] },
                { name: '所有文件', extensions: ['*'] }
            ]
        });

        if (canceled || !filePath) {
            return { success: false, reason: 'Canceled' };
        }

        await fs.promises.writeFile(filePath, content, 'utf8');
        return { success: true, path: filePath };
    } catch (err: any) {
        console.error('Failed to save note:', err);
        return { success: false, reason: err.message || 'Unknown error' };
    }
});
ipcMain.handle('select-note-save-folder', async () => {
    if (!mainWindow) return { canceled: true };
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择笔记保存文件夹',
        properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
    }
    return { canceled: false, path: result.filePaths[0] };
});

// Return the user's Documents folder as the default note save location.
ipcMain.handle('get-default-note-save-path', () => {
    return app.getPath('documents');
});

// Auto-sync: write every note as a .md file into the configured folder.
// Called whenever the save folder is set/changed or notes are updated.
ipcMain.handle('save-notes-to-dir', async (_event, { dir, notes }) => {
    console.log('[NoteSync] dir=' + JSON.stringify(dir) + ' notes=' + (notes || []).length);
    try {
        await fs.promises.mkdir(dir, { recursive: true });
        // Files currently present in the folder (this sync owns *.md files).
        let existing: string[] = [];
        try {
            existing = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.md'));
        } catch { /* dir may not exist yet */ }
        const expected = new Set<string>();
        for (const note of notes || []) {
            if (!note || note.isSettings || !note.title) continue;
            // Sanitize title for filename; append a star when the note is favorited.
            const base = note.title.replace(/[^a-z0-9\u4e00-\u9fff]/gi, '_');
            // Favorited notes get a heart symbol in the filename (NTFS-safe).
            const fileName = (note.isFavorite ? base + '♥' : base) + '.md';
            expected.add(fileName);
            const filePath = path.join(dir, fileName);
            await fs.promises.writeFile(filePath, note.content, 'utf8');
        }
        // Remove .md files that no longer correspond to any note (deleted notes).
        for (const f of existing) {
            if (!expected.has(f)) {
                try { await fs.promises.unlink(path.join(dir, f)); } catch { /* ignore */ }
            }
        }
        return { success: true };
    } catch (err) {
        console.error('Failed to auto-save notes:', err);
        return { success: false, reason: String(err) };
    }
});

ipcMain.on('enter-pin-targeting', () => {
    if (isMac) {
        // macOS: Panel windows don't fire blur events reliably.
        // Implement pseudo-pin: immediately elevate KoBar to screen-saver level.
        if (mainWindow) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
            mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
            pinnedHwnd = 1;
            mainWindow.webContents.send('pinned-window-changed', 1);
            mainWindow.webContents.send('pin-targeting-complete');
        }
        return;
    }
    isAwaitingPinTarget = true;
});

ipcMain.on('unpin-current-window', () => {
    if (isWin && pinnedHwnd) {
        const hwndToUnpin = pinnedHwnd;
        const psUnpinScript = `
        $hwnd = [IntPtr]${hwndToUnpin}
        $HWND_NOTOPMOST = -2
        [K]::SetWindowPos($hwnd, $HWND_NOTOPMOST, 0, 0, 0, 0, 3)
        `;
        if (psProcess && psProcess.stdin) {
            psProcess.stdin.write(psUnpinScript + '\n');
        }
        allPinnedHwnds.delete(hwndToUnpin);
        stopWindowTracking();
    } else if (isMac && mainWindow) {
        mainWindow.setAlwaysOnTop(true, 'floating', 1);
        pinnedHwnd = null;
        mainWindow.webContents.send('pinned-window-changed', null);
    }
});

ipcMain.on('unpin-all-windows', () => {
    if (isWin && allPinnedHwnds.size > 0) {
        let psUnpinAllScript = '';
        allPinnedHwnds.forEach(hwnd => {
            psUnpinAllScript += `[K]::SetWindowPos([IntPtr]${hwnd}, -2, 0, 0, 0, 0, 3)\n`;
        });
        if (psProcess && psProcess.stdin) {
            psProcess.stdin.write(psUnpinAllScript + '\n');
        }
        allPinnedHwnds.clear();
        stopWindowTracking();
        // Reset frontend targeting state
        mainWindow?.webContents.send('pin-targeting-complete');
    }
});

ipcMain.on('send-notification', (_event, { title, body }) => {
    const { Notification } = require('electron');
    new Notification({ title, body }).show();
});

function startWindowTracking(hwnd: number) {
    if (borderWindow) borderWindow.destroy();
    // Reset any stale tracking state (a previous chain may still be in flight).
    if (trackingInterval) { clearTimeout(trackingInterval); trackingInterval = null; }
    if (windowTrackIdleTimer) { clearTimeout(windowTrackIdleTimer); windowTrackIdleTimer = null; }
    windowTrackInFlight = false;
    windowTrackOutBuffer = '';

    pinnedHwnd = hwnd;
    mainWindow?.webContents.send('pinned-window-changed', hwnd);

    borderWindow = new BrowserWindow({
        width: 1,
        height: 1,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: false,
        webPreferences: { nodeIntegration: false }
    });
    borderWindow.setIgnoreMouseEvents(true);
    borderWindow.showInactive();
    borderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    borderWindow.loadURL(`data:text/html,<body style="margin:0;padding:2px;overflow:hidden;border:8px solid %23ef4444;box-sizing:border-box;width:100vw;height:100vh;background:transparent;"></body>`);

    // Kick off the serialized tracking chain (first poll immediately, then on a 250ms cadence).
    pollPinnedWindowPosition();
}

function scheduleWindowTrackPoll() {
    if (trackingInterval) clearTimeout(trackingInterval);
    trackingInterval = setTimeout(pollPinnedWindowPosition, WINDOW_TRACK_POLL_MS);
}

function pollPinnedWindowPosition() {
    if (!borderWindow || !pinnedHwnd || borderWindow.isDestroyed()) return;
    const ps = psProcess;
    if (!ps?.stdin?.writable || !ps.stdout || windowTrackInFlight) return;

    // Serialize queries: only one request in flight at a time, so replies from the
    // shared PowerShell host can never pile up or cross-talk with each other.
    windowTrackInFlight = true;

    const psPosScript = `
    $hwnd = [IntPtr]${pinnedHwnd}
    $rect = New-Object K+RECT
    if ([K]::GetWindowRect($hwnd, [ref]$rect)) {
        Write-Output "POS:$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"
    } else {
        Write-Output "LOST"
    }
    `;

    // The reply comes back on STDOUT. (The old code attached this listener to
    // stdin — a Writable stream that never emits 'data' — so the border never
    // tracked and the PS host still received an unanswered query every 50ms.)
    ps.stdout.once('data', onWindowTrackReply);

    // Safety net: a lost/swallowed reply must not stall the tracking chain.
    if (windowTrackIdleTimer) clearTimeout(windowTrackIdleTimer);
    windowTrackIdleTimer = setTimeout(() => {
        windowTrackInFlight = false;
        scheduleWindowTrackPoll();
    }, WINDOW_TRACK_POLL_MS * 4);

    ps.stdin.write(psPosScript + '\n');
}

function onWindowTrackReply(data: Buffer) {
    // 'data' chunks don't align with Write-Output lines; buffer and split by '\n'.
    windowTrackOutBuffer += data.toString();
    let newlineIdx: number;
    while ((newlineIdx = windowTrackOutBuffer.indexOf('\n')) >= 0) {
        const line = windowTrackOutBuffer.slice(0, newlineIdx).trim();
        windowTrackOutBuffer = windowTrackOutBuffer.slice(newlineIdx + 1);
        if (!line) continue;

        if (line.includes('POS:')) {
            windowTrackInFlight = false;
            if (windowTrackIdleTimer) { clearTimeout(windowTrackIdleTimer); windowTrackIdleTimer = null; }

            const parts = line.split('POS:')[1].trim().split(',');

            // Native Windows rect is in PHYSICAL pixels
            const physLeft = parseInt(parts[0]);
            const physTop = parseInt(parts[1]);
            const physRight = parseInt(parts[2]);
            const physBottom = parseInt(parts[3]);

            const physWidth = physRight - physLeft;
            const physHeight = physBottom - physTop;

            // Electron setBounds expects LOGICAL pixels
            const primaryDisplay = screen.getPrimaryDisplay();
            const sf = primaryDisplay.scaleFactor;

            if (borderWindow && !borderWindow.isDestroyed()) {
                const logicalX = Math.round(physLeft / sf);
                const logicalY = Math.round(physTop / sf);
                const logicalW = Math.round(physWidth / sf);
                const logicalH = Math.round(physHeight / sf);

                // Surgical logging for verification
                console.log(`[TRK] HWND:${pinnedHwnd} | L:${logicalX} T:${logicalY} W:${logicalW} H:${logicalH}`);

                borderWindow.setBounds({
                    x: logicalX,
                    y: logicalY,
                    width: logicalW,
                    height: logicalH
                });

                // Ensure it stays on top even if the pinned window is re-focused
                borderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
            }

            scheduleWindowTrackPoll();
        } else if (line.includes('LOST')) {
            windowTrackInFlight = false;
            if (windowTrackIdleTimer) { clearTimeout(windowTrackIdleTimer); windowTrackIdleTimer = null; }
            stopWindowTracking();
        }
        // Other stray lines are ignored — the idle timer keeps the chain alive
        // if a reply never arrives.
    }
}

function stopWindowTracking() {
    pinnedHwnd = null;
    if (trackingInterval) { clearTimeout(trackingInterval); trackingInterval = null; }
    if (windowTrackIdleTimer) { clearTimeout(windowTrackIdleTimer); windowTrackIdleTimer = null; }
    windowTrackInFlight = false;
    windowTrackOutBuffer = '';
    if (borderWindow) {
        borderWindow.destroy();
        borderWindow = null;
    }
    mainWindow?.webContents.send('pinned-window-changed', null);
}

function resolvePhysicalPath(p: string): string {
    if (process.windowsStore && isWin && p) {
        try {
            let packageFullName = '';
            let current = process.execPath;
            while (true) {
                const parent = path.dirname(current);
                if (!parent || parent === current) break;
                if (path.basename(parent).toLowerCase() === 'windowsapps') {
                    packageFullName = path.basename(current);
                    break;
                }
                current = parent;
            }
            if (!packageFullName) {
                packageFullName = path.basename(path.dirname(process.execPath));
            }
            const match = packageFullName.match(/^([a-zA-Z0-9.-]+)_(\d+(?:\.\d+)+)_(?:.*_)?([a-zA-Z0-9]{13})$/);
            if (match) {
                const name = match[1];
                const publisherId = match[3];
                const packageFamilyName = `${name}_${publisherId}`;
                const localAppData = process.env.LOCALAPPDATA;
                if (localAppData) {
                    const appDataRoaming = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
                    const relativePath = path.relative(appDataRoaming, p);
                    if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                        return path.join(localAppData, 'Packages', packageFamilyName, 'LocalCache', 'Roaming', relativePath);
                    }
                    const relativeLocalPath = path.relative(localAppData, p);
                    if (!relativeLocalPath.startsWith('..') && !path.isAbsolute(relativeLocalPath) && !relativeLocalPath.startsWith('Packages')) {
                        return path.join(localAppData, 'Packages', packageFamilyName, 'LocalState', relativeLocalPath);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to resolve physical path for AppX container:', err);
        }
    }
    return p;
}

const koBoxPath = path.join(app.getPath('userData'), 'KoBox');

function cleanKoBox(mode: '24h' | 'quit') {
    if (!fs.existsSync(koBoxPath)) return;
    try {
        const files = fs.readdirSync(koBoxPath);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(koBoxPath, file);
            const stats = fs.statSync(filePath);
            if (mode === 'quit' || (mode === '24h' && now - stats.mtimeMs > 24 * 60 * 60 * 1000)) {
                fs.rmSync(filePath, { recursive: true, force: true });
            }
        });
    } catch (e) {
        console.error('KoBox Cleanup Error:', e);
    }
}

ipcMain.on('kobox-drop', (event, filePaths: string[]) => {
    if (!fs.existsSync(koBoxPath)) fs.mkdirSync(koBoxPath, { recursive: true });
    filePaths.forEach(src => {
        if (!src) return;
        try {
            const dest = path.join(koBoxPath, path.basename(src));

            // First attempt: Fast rename (move)
            try {
                fs.renameSync(src, dest);
            } catch (renameErr) {
                // Fallback: If moving across different drives/partitions fails, copy then delete original
                fs.copyFileSync(src, dest);
                fs.rmSync(src, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('KoBox Move Error:', e);
        }
    });
});

ipcMain.on('kobox-open', () => {
    if (!fs.existsSync(koBoxPath)) {
        fs.mkdirSync(koBoxPath, { recursive: true });
    }
    const targetPath = resolvePhysicalPath(koBoxPath);
    shell.openPath(targetPath);
});
ipcMain.on('kobox-clean', (event, mode: '24h' | 'quit') => cleanKoBox(mode));

// AI Hub Fetch API & File Parsing 
ipcMain.handle('parse-file', async (event, filePath: string) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return { type: 'text', content: data.text as string };
        } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            const buff = fs.readFileSync(filePath);
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return { type: 'image', content: `data:${mime};base64,${buff.toString('base64')}` };
        } else {
            // Assume text for txt, md, json, js, ts, etc
            return { type: 'text', content: fs.readFileSync(filePath, 'utf-8') };
        }
    } catch (e) {
        console.error('Parse file error:', e);
        return { type: 'error', content: String(e) };
    }
});

let cancelControllers: Record<string, AbortController> = {};

ipcMain.handle('cancel-llm-request', (event, messageId: string) => {
    if (cancelControllers[messageId]) {
        cancelControllers[messageId].abort();
        delete cancelControllers[messageId];
    }
});

ipcMain.handle('llm-request', async (event, data: { chatId: string, messageId: string, provider: string, model: string, messages: any[], apiKeys: any, systemPrompt?: string }) => {
    const { chatId, messageId, provider, model, messages, apiKeys, systemPrompt } = data;

    // Explicitly extract the correct key for validation
    let apiKey = '';
    if (apiKeys) {
        if (provider === 'openai') apiKey = apiKeys.openai;
        if (provider === 'gemini') apiKey = apiKeys.gemini;
        if (provider === 'anthropic') apiKey = apiKeys.anthropic;
    }

    // Validation: Prevent cloud calls without keys
    if (provider !== 'local' && (!apiKey || apiKey.trim() === '')) {
        if (mainWindow) {
            mainWindow.webContents.send('llm-stream-error', {
                chatId,
                messageId,
                error: `${provider.toUpperCase()} API key not found. Please check your AI Hub settings.`
            });
        }
        return;
    }

    cancelControllers[messageId] = new AbortController();
    const signal = cancelControllers[messageId].signal;

    try {
        let url = '';
        let headers: any = {};
        let body: any = {};

        let finalMessages = [...messages];

        if (provider === 'openai' || provider === 'gemini') {
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        } else if (provider === 'anthropic') {
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };
        }

        if (provider === 'openai') {
            if (systemPrompt) {
                finalMessages.unshift({ role: 'system', content: systemPrompt });
            }
            url = 'https://api.openai.com/v1/chat/completions';
            body = {
                model: model || 'gpt-4o',
                messages: finalMessages,
                stream: true
            };
        } else if (provider === 'anthropic') {
            url = 'https://api.anthropic.com/v1/messages';

            // Translate multimodal (image) payloads to Anthropic's schema
            const anthropicMessages = finalMessages.map((m: any) => {
                if (Array.isArray(m.content)) {
                    const translatedContent = m.content.map((part: any) => {
                        if (part.type === 'image_url') {
                            const dataUrl = part.image_url.url;
                            const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
                            if (matches) {
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: matches[1], // e.g., image/jpeg, image/png
                                        data: matches[2] // pure base64
                                    }
                                };
                            }
                        }
                        return part; // Keep text parts unchanged
                    });
                    return { role: m.role, content: translatedContent };
                }
                return m;
            });

            body = {
                model: model || 'claude-sonnet-4-6',
                max_tokens: 4096,
                messages: anthropicMessages,
                stream: true
            };
            if (systemPrompt) {
                body.system = systemPrompt;
            }
        } else if (provider === 'gemini') {
            let geminiModel = model.replace('gemini:', '').replace('-latest', '');

            // Use the official OpenAI compatibility endpoint
            url = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

            if (systemPrompt) {
                finalMessages.unshift({ role: 'system', content: systemPrompt });
            }

            body = {
                model: geminiModel || 'gemini-3.1-flash',
                messages: finalMessages,
                stream: true
            };
        } else if (provider === 'local') {
            // 1. Detect if it's Ollama or LM Studio
            let endpoint = (apiKeys?.localUrl || 'http://localhost:11434').replace(/\/v1\/?$/, '').replace(/\/api\/?$/, '').replace(/\/+$/, '');
            const isOllama = endpoint.includes('11434') || (apiKeys?.localUrl || '').toLowerCase().includes('ollama');

            // 2. Check for vision/multimodal payload
            const hasVision = finalMessages.some((m: any) => Array.isArray(m.content));

            // 3. SAFE System Prompt Injection (Disable for local vision to prevent looping)
            if (systemPrompt && !hasVision) {
                finalMessages.unshift({ role: 'system', content: systemPrompt });
            }

            headers = { 'Content-Type': 'application/json' };

            if (isOllama) {
                // OLLAMA NATIVE API
                url = endpoint + '/api/chat';
                const ollamaMessages = finalMessages.map((m: any) => {
                    if (Array.isArray(m.content)) {
                        let textContent = '';
                        let images: string[] = [];
                        m.content.forEach((part: any) => {
                            if (part.type === 'text') textContent += part.text + '\n';
                            if (part.type === 'image_url') {
                                // Ollama expects raw base64 without data:image prefix
                                images.push(part.image_url.url.replace(/^data:image\/\w+;base64,/, ''));
                            }
                        });
                        return { role: m.role, content: textContent.trim(), images: images.length > 0 ? images : undefined };
                    }
                    return m;
                });
                body = {
                    model: model.replace('local:', '') || 'llava',
                    messages: ollamaMessages,
                    stream: true
                };
            } else {
                // LM STUDIO (OpenAI API Compatibility)
                url = endpoint + '/v1/chat/completions';
                body = {
                    model: model.replace('local:', '') || 'local-model',
                    messages: finalMessages,
                    stream: true,
                    max_tokens: 2048,
                    temperature: 0.7
                };
            }
        }


        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`API Error: ${res.status} - ${errorText}`);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder("utf-8");

        if (reader && mainWindow) {
            let buffer = '';
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep the incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') continue;


                    if (trimmed.startsWith('data: ')) {
                        try {
                            const dataPayload = JSON.parse(trimmed.substring(6));
                            let chunk = '';
                            if (provider === 'anthropic') {
                                if (dataPayload.type === 'content_block_delta') {
                                    chunk = dataPayload.delta.text || '';
                                }
                            } else {
                                chunk = dataPayload.choices?.[0]?.delta?.content || '';
                            }

                            if (chunk) {
                                mainWindow.webContents.send('llm-stream-chunk', { chatId, messageId, chunk });
                            }
                        } catch (e) {
                            // ignore unparseable chunks
                        } // handle JSON parses safely for tiny chunks
                    }
                }
            }
            if (buffer && mainWindow) {
                // Flush remaining
                try {
                    if (buffer.startsWith('data: ')) {
                        const finalPayload = JSON.parse(buffer.substring(6));
                        let chunk = '';
                        if (provider === 'anthropic') {
                            if (finalPayload.type === 'content_block_delta') {
                                chunk = finalPayload.delta.text || '';
                            }
                        } else {
                            chunk = finalPayload.choices?.[0]?.delta?.content || '';
                        }
                        if (chunk) mainWindow.webContents.send('llm-stream-chunk', { chatId, messageId, chunk });
                    }
                } catch (e) { }
            }
            mainWindow.webContents.send('llm-stream-end', { chatId, messageId });
        }

    } catch (e: any) {
        if (e.name === 'AbortError') {
            console.log('LLM Request aborted');
        } else {
            if (mainWindow) {
                const errorMessage = e instanceof Error ? e.message : (typeof e === 'object' ? JSON.stringify(e) : String(e));
                mainWindow.webContents.send('llm-stream-error', { chatId, messageId, error: errorMessage });
            }
        }
    } finally {
        delete cancelControllers[messageId];
    }
});

// Auto-launch at system startup removed

ipcMain.on('write-to-clipboard', (_event, data: { type: string; content: string }) => {
    console.log('[clipboard] write-to-clipboard received:', data?.type, 'len=', data?.content?.length);
    if (data.type === 'text') {
        clipboard.writeText(data.content);
        console.log('[clipboard] text written, ok');
    } else if (data.type === 'image') {
        const img = nativeImage.createFromDataURL(data.content);
        clipboard.writeImage(img);
    }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.setIgnoreMouseEvents(ignore, { forward: true });
    }
});

ipcMain.on('set-global-paste-mode', (event, isActive) => {
    isGlobalPasteModeActive = isActive;
    if (isActive) {
        globalShortcut.register('CommandOrControl+V', () => {
            if (mainWindow) mainWindow.webContents.send('request-next-paste');
        });
    } else {
        globalShortcut.unregister('CommandOrControl+V');
        if (isWin && psProcess && psProcess.stdin) {
            psProcess.stdin.write('[K]::keybd_event(0x11, 0, 2, 0)\n[K]::keybd_event(0x10, 0, 2, 0)\n[K]::keybd_event(0x12, 0, 2, 0)\n');
        }
    }
});

ipcMain.on('execute-global-paste', (event, data) => {
    if (data.type === 'text') {
        clipboard.writeText(data.content);
    } else if (data.type === 'image') {
        const img = nativeImage.createFromDataURL(data.content);
        clipboard.writeImage(img);
    }
    globalShortcut.unregister('CommandOrControl+V');

    if (isWin) {
        const psPaste = `
$isDown = ([K]::GetAsyncKeyState(0x11) -band 0x8000) -ne 0
if (-not $isDown) { [K]::keybd_event(0x11, 0, 0, 0) }
[K]::keybd_event(0x56, 0, 0, 0)
[K]::keybd_event(0x56, 0, 2, 0)
if (-not $isDown) { [K]::keybd_event(0x11, 0, 2, 0) }
`;
        if (psProcess && psProcess.stdin) {
            psProcess.stdin.write(psPaste + '\n');
        }

        // Re-register shortcut ONLY AFTER the simulated keystroke has fully resolved.
        // On Windows, PowerShell stdin write has unpredictable latency, so we wait 200ms.
        setTimeout(() => {
            if (isGlobalPasteModeActive) {
                globalShortcut.register('CommandOrControl+V', () => {
                    if (mainWindow) mainWindow.webContents.send('request-next-paste');
                });
            }
        }, 200);
    } else if (isMac) {
        // macOS: Check Accessibility permission (required for keystroke injection)
        const macSysPrefs = require('electron').systemPreferences;
        const accessibilityGranted = macSysPrefs.isTrustedAccessibilityClient(false);

        if (!accessibilityGranted) {
            // Prompt user to grant Accessibility
            macSysPrefs.isTrustedAccessibilityClient(true);
            mainWindow?.webContents.send('clipboard-paste-error', {
                error: 'accessibility_required',
                message: '在系统设置中为 KoBar 启用辅助功能'
            });
            // Re-register shortcut immediately since paste won't happen
            if (isGlobalPasteModeActive) {
                globalShortcut.register('CommandOrControl+V', () => {
                    if (mainWindow) mainWindow.webContents.send('request-next-paste');
                });
            }
            return;
        }

        // Hide KoBar to ensure target app has focus for the keystroke
        if (mainWindow) mainWindow.hide();

        // Short delay: let the target app fully gain focus
        setTimeout(() => {
            exec('osascript -e \'tell application "System Events"\n  delay 0.05\n  keystroke "v" using command down\nend tell\'', (err, stdout, stderr) => {
                if (err) console.error('[Clipboard] macOS Paste Error:', stderr || err);

                // Restore KoBar
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
                }

                // Re-register shortcut ONLY AFTER osascript keystroke has fully resolved
                setTimeout(() => {
                    if (isGlobalPasteModeActive) {
                        globalShortcut.register('CommandOrControl+V', () => {
                            if (mainWindow) mainWindow.webContents.send('request-next-paste');
                        });
                    }
                }, 150);
            });
        }, 100);
        return; // Early return to avoid the default timeout below
    }

    setTimeout(() => {
        if (isGlobalPasteModeActive) {
            globalShortcut.register('CommandOrControl+V', () => {
                if (mainWindow) mainWindow.webContents.send('request-next-paste');
            });
        }
    }, 600);
});

// 鈹€鈹€鈹€ Screenshot Studio: Custom In-App Capture 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
// Keep legacy trigger-screenshot for backward compat (e.g. PrintScreen key)
ipcMain.on('trigger-screenshot', () => {
    if (isWin) {
        if (psProcess && psProcess.stdin) {
            const psScreenshot = `
[K]::keybd_event(0x2C, 0, 0, 0)
[K]::keybd_event(0x2C, 0, 2, 0)
`;
            psProcess.stdin.write(psScreenshot + '\n');
        }
    } else if (isMac) {
        exec('screencapture -i -c');
    }
});

// Legacy take-screenshot kept for backward compatibility
ipcMain.on('take-screenshot', (event, hideApp) => {
    if (hideApp && mainWindow) {
        mainWindow.hide();
    }
    setTimeout(() => {
        if (isWin) {
            shell.openExternal('ms-screenclip:');
        } else if (isMac) {
            exec('screencapture -i -c', () => {
                if (hideApp && mainWindow) {
                    mainWindow.show();
                    mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                }
            });
        }
    }, 150);
});

// 鈹€鈹€鈹€ NEW: Custom Screenshot Studio Capture 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
const { systemPreferences } = require('electron');
let screenshotOverlayWindows: BrowserWindow[] = [];
let preScreenshotBounds: { x: number; y: number; width: number; height: number; } | null = null;

ipcMain.handle('start-screenshot-capture', async () => {
    // 0a. macOS Permission Check
    if (isMac) {
        const screenStatus = systemPreferences.getMediaAccessStatus('screen');
        if (screenStatus !== 'granted') {
            const response = await dialog.showMessageBox({
                type: 'warning',
                title: '需要屏幕录制权限',
                message: 'KoBar 需要使用屏幕录制权限才能使用截图工具。',
                detail: 'Please enable "Screen Recording" 为 KoBar 启用"屏幕录制"，然后重新启动 application.',
                buttons: ['打开系统设置', '取消'],
                defaultId: 0,
                cancelId: 1
            });

            if (response.response === 0) {
                shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
            }

            // Abort gracefully
            return { captures: [], windowPosition: { x: 0, y: 0 }, error: 'permission_denied' };
        }
    }

    // 0b. Compute multi-monitor boundaries
    const displays = screen.getAllDisplays();
    let minX = displays[0].bounds.x, minY = displays[0].bounds.y;
    let maxX = displays[0].bounds.x + displays[0].bounds.width;
    let maxY = displays[0].bounds.y + displays[0].bounds.height;

    displays.forEach(d => {
        if (d.bounds.x < minX) minX = d.bounds.x;
        if (d.bounds.y < minY) minY = d.bounds.y;
        if (d.bounds.x + d.bounds.width > maxX) maxX = d.bounds.x + d.bounds.width;
        if (d.bounds.y + d.bounds.height > maxY) maxY = d.bounds.y + d.bounds.height;
    });

    // 1. Hide KoBar and temporarily resize it to cover ALL monitors seamlessly
    if (mainWindow) {
        preScreenshotBounds = mainWindow.getBounds();
        mainWindow.setAlwaysOnTop(false); // DEMOTE BEFORE HIDE TO PREVENT BLACK SCREEN
        mainWindow.setBounds({
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        });
        mainWindow.hide();
    }

    // 2. Wait for the OS to fully render the desktop without KoBar
    await new Promise(resolve => setTimeout(resolve, 200));

    // 3. Grab all displays
    // (displays already grabbed above)

    // 4. Capture all screens using desktopCapturer
    const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
            // Use logical bounds instead of scaleFactor to prevent memory limits and empty thumbnails
            width: Math.max(...displays.map(d => d.bounds.width)),
            height: Math.max(...displays.map(d => d.bounds.height)),
        }
    });

    // 5. Build per-display capture data
    const captureData = displays.map((display) => {
        // Correctly match the desktopCapturer screen source to the physical display
        let source = sources.find((s: any) => s.display_id === display.id.toString());
        // Fallback for edge-cases where ID parsing fails
        if (!source) {
            source = sources.find((s: any) => s.name === `Screen ${display.id}`) || sources[0];
        }
        const thumbnail = source.thumbnail;
        
        if (thumbnail.isEmpty()) {
            console.error(`[KoBar] WARNING: desktopCapturer returned empty thumbnail for display ${display.id}`);
        }

        return {
            displayId: display.id.toString(),
            bounds: display.bounds,
            scaleFactor: display.scaleFactor,
            imageDataUrl: thumbnail.toDataURL(),
        };
    });

    // 6. Get the ghost window position for coordinate mapping
    //    The renderer needs this to position the overlay at the correct
    //    offset within the 6000脳4000 ghost window.
    const windowPos = mainWindow ? mainWindow.getPosition() : [0, 0];

    // 7. Show KoBar back so the overlay React component becomes visible
    if (mainWindow) {
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
    }

    return {
        captures: captureData,
        windowPosition: { x: windowPos[0], y: windowPos[1] },
    };
});

// Cancel screenshot mode and restore KoBar
ipcMain.on('cancel-screenshot', () => {
    if (mainWindow) {
        if (preScreenshotBounds) mainWindow.setBounds(preScreenshotBounds);
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
    }
});

// Save screenshot to file
ipcMain.handle('save-screenshot', async (_event, data: { buffer: string; format: string; destinationPath?: string; defaultPath?: string }) => {
    const { buffer, format, destinationPath } = data;

    // Convert base64 data URL to Buffer
    const base64Data = buffer.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    let savePath = destinationPath;

    if (!savePath) {
        // Temporarily disable alwaysOnTop to ensure the dialog appears ON TOP of the screen-filler ghost window
        if (mainWindow) mainWindow.setAlwaysOnTop(false);

        // Open native save dialog as fallback
        const result = await dialog.showSaveDialog(mainWindow!, {
            title: '保存截图',
            defaultPath: data.defaultPath ? path.join(data.defaultPath, `KoBar_Screenshot_${Date.now()}.${format}`) : path.join(app.getPath('desktop'), `KoBar_Screenshot_${Date.now()}.${format}`),
            filters: [
                { name: '图片', extensions: [format] }
            ]
        });

        // Restore alwaysOnTop
        if (mainWindow) mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);

        if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' };
        savePath = result.filePath;
    }

    try {
        await fs.promises.writeFile(savePath, imageBuffer);
        return { success: true, path: savePath };
    } catch (e) {
        console.error('Screenshot save error:', e);
        return { success: false, reason: String(e) };
    }
});

// Copy screenshot to system clipboard
ipcMain.on('copy-screenshot-to-clipboard', (_event, dataUrl: string) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
});

// Restore KoBar window after screenshot session finishes
ipcMain.on('screenshot-session-complete', () => {
    if (mainWindow) {
        if (preScreenshotBounds) mainWindow.setBounds(preScreenshotBounds);
        mainWindow.show();
        mainWindow.setAlwaysOnTop(true, isMac ? 'floating' : 'screen-saver', 1);
    }
});

ipcMain.on('move-window', (event, { dx, dy }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        win.setPosition(Math.round(x + dx), Math.round(y + dy));
    }
});

ipcMain.handle('recenter-window-on-widget', async (event, relativeX, relativeY, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const [winX, winY] = win.getPosition();
    const physicalX = winX + relativeX;
    const physicalY = winY + relativeY;

    // Find nearest display to the widget center
    const activeDisplay = screen.getDisplayNearestPoint({ 
        x: Math.round(physicalX + width / 2), 
        y: Math.round(physicalY + height / 2) 
    });

    // The ghost window already spans every display, so the window never needs
    // to move; widget coordinates stay relative to the window origin.
    const newRelativeX = relativeX;
    const newRelativeY = relativeY;

    // Trigger edge-changed to update screen bounds in the frontend
    handleWindowMove(true);

    return { x: newRelativeX, y: newRelativeY, displayBounds: activeDisplay.workArea };
});

ipcMain.on('get-window-position-sync', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    event.returnValue = win ? win.getPosition() : [0, 0];
});

ipcMain.on('get-ghost-center-sync', (event) => {
    // Window-relative center of the ghost window, so the renderer can compute
    // physical pixel positions without hard-coding the window dimensions.
    event.returnValue = getGhostCenter();
});

ipcMain.handle('get-displays-info', () => {
    return {
        primaryDisplay: screen.getPrimaryDisplay(),
        allDisplays: screen.getAllDisplays()
    };
});

ipcMain.handle('get-screen-bounds', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const [x, y] = win.getPosition();
        const [width] = win.getSize();
        const windowCenter = x + (width / 2);
        const activeDisplay = screen.getDisplayNearestPoint({ x: windowCenter, y: 100 });
        return activeDisplay.workArea;
    }
    return screen.getPrimaryDisplay().workArea;
});

ipcMain.on('update-sidebar-rect', (event, rect) => {
    sidebarRect = { ...sidebarRect, ...rect };
});

/* 
ipcMain.on('register-teleport-shortcut', (event, shortcut) => {
    if (teleportShortcutKey) globalShortcut.unregister(teleportShortcutKey);
    teleportShortcutKey = shortcut;
    if (shortcut) {
        try {
            globalShortcut.register(shortcut, () => {
                if (!mainWindow) return;
                const cursor = screen.getCursorScreenPoint();
                // KoBar Sidebar is statically positioned at y=20 (pt-[20px]).
                // We must use a targetVisualY close to 20 (e.g., 100) instead of half of height,
                // otherwise restoring the window from the eye will place the sidebar off-screen.
                const targetVisualX = getGhostCenter().x;
                const targetVisualY = 100;
                const newX = cursor.x - targetVisualX;
                const newY = cursor.y - targetVisualY;
                
                mainWindow.setPosition(Math.round(newX), Math.round(newY));
                mainWindow.webContents.send('teleport-triggered', { x: targetVisualX, y: targetVisualY });
                
                if (!mainWindow.isVisible()) mainWindow.show();
                mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
            });
        } catch (e) {
            console.error('Failed to register teleport shortcut', e);
        }
    }
});
*/

ipcMain.handle('get-file-icon', async (_event, filePath: string) => {
    try {
        // Step A: Resolve target path for .lnk shortcut files
        let targetPath = filePath;
        if (isWin && filePath.toLowerCase().endsWith('.lnk')) {
            targetPath = await new Promise<string>((resolve) => {
                const psScript = `
                $shell = New-Object -ComObject WScript.Shell
                $link = $shell.CreateShortcut("${filePath}")
                $link.TargetPath
                `;
                exec(`powershell -NoProfile -Command "${psScript}"`, (error, stdout) => {
                    if (error || !stdout.trim()) {
                        resolve(filePath); // Fallback to original path
                        return;
                    }
                    resolve(stdout.trim());
                });
            });
        }

        // Step B: Use Electron's native API to get the file icon
        const icon = await app.getFileIcon(targetPath, { size: 'large' });
        return icon.toDataURL();
    } catch (e) {
        console.error('Failed to get file icon:', e);
        return null;
    }
});

ipcMain.on('launch-file', async (event, filePath) => {
    if (!filePath || typeof filePath !== 'string') {
        console.error('Launch failed: Invalid or undefined file path received.');
        return;
    }
    try {
        if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
            shell.openExternal(filePath);
        } else {
            const errorMessage = await shell.openPath(filePath);
            if (errorMessage) {
                console.error('Shell error opening path:', errorMessage);
            }
        }
    } catch (e) {
        console.error('Failed to launch application / open link:', e);
    }
});

// IPC map to expose the Hardware ID synchronously generated from LicenseManager
ipcMain.handle('get-hwid', () => {
    return LicenseManager.getDeviceHWID();
});


ipcMain.handle('is-dev', () => {
    return isDev;
});

ipcMain.handle('start-eyedropper', async () => {
    isEyeDropperActive = true;
    return { x: 0, y: 0 };
});

ipcMain.handle('stop-eyedropper', async () => {
    isEyeDropperActive = false;
});
