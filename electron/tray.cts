import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';

// ─── System Tray ──────────────────────────────────────────────────────────
// Owns the tray icon and its context menu. All window access is injected so
// this module stays decoupled from the rest of the main process.

interface TrayOptions {
    getWindow: () => BrowserWindow | null;
    onTeleport: () => void;
}

export function createTray(options: TrayOptions): Tray {
    const { getWindow, onTeleport } = options;

    // Resolve the icon path dynamically for both development and packaged environments
    // Dev path relative to dist-electron: ../build/icon-256x256.ico
    const iconPath = path.join(__dirname, '../build/icon-256x256.ico');

    let trayIcon = nativeImage.createFromPath(iconPath);

    // Fallback resolution using the app root if current path fails
    if (trayIcon.isEmpty()) {
        const rootPath = path.join(app.getAppPath(), 'build/icon-256x256.ico');
        trayIcon = nativeImage.createFromPath(rootPath);
    }

    // In case of emergency (still empty), attempt to use a standard PNG logo as last resort
    if (trayIcon.isEmpty()) {
        const pngPath = path.join(__dirname, '../build/icon.png');
        trayIcon = nativeImage.createFromPath(pngPath).resize({ width: 16, height: 16 });
    }

    const tray = new Tray(trayIcon);

    const toggleWindow = () => {
        const win = getWindow();
        if (!win) return;
        if (win.isVisible() && !win.isMinimized()) {
            win.hide();
        } else {
            // Teleport to primary display center before showing
            onTeleport();
        }
    };

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示/隐藏 KoBar',
            click: toggleWindow
        },
        {
            label: '设置',
            click: () => {
                const win = getWindow();
                if (win) {
                    onTeleport();
                    win.webContents.send('open-settings');
                }
            }
        },
        {
            label: '传送到中心',
            click: onTeleport
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('KoBar');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', toggleWindow);

    return tray;
}
