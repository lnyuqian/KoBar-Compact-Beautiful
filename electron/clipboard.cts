import { clipboard, BrowserWindow } from 'electron';

// ─── Clipboard Polling ────────────────────────────────────────────────────
// The main process watches the OS clipboard and forwards text/image changes to
// the renderer. Polling is used instead of a native format listener so the app
// can also react to image-only changes; the interval is 500ms on Windows and
// 1000ms on macOS, and can be stopped entirely from the privacy toggle.

export interface ClipboardController {
    start: () => void;
    stop: () => void;
    // Records content written by the app itself so the polling loop does not
    // echo it back to the renderer as a "new" clipboard item.
    markWritten: (data: { type: string; content: string }) => void;
}

interface ClipboardControllerOptions {
    getWindow: () => BrowserWindow | null;
    isMac: boolean;
}

export function createClipboardController(options: ClipboardControllerOptions): ClipboardController {
    const { getWindow, isMac } = options;

    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let lastClipboardText = '';
    let lastClipboardImageDataUrl = '';
    let lastClipboardImageBmp: Buffer | null = null;

    function start() {
        if (pollingInterval) return;
        lastClipboardText = clipboard.readText() || '';
        const initialImg = clipboard.readImage();
        lastClipboardImageDataUrl = initialImg.isEmpty() ? '' : initialImg.toDataURL();
        pollingInterval = setInterval(() => {
            const mainWindow = getWindow();
            if (!mainWindow) return;

            const formats = clipboard.availableFormats();

            // 1. FAST PATH: Check for Text
            if (formats.includes('text/plain')) {
                const currentText = clipboard.readText() || '';
                if (currentText && currentText !== lastClipboardText) {
                    lastClipboardText = currentText;
                    lastClipboardImageDataUrl = '';
                    lastClipboardImageBmp = null; // Clear raw image cache to free RAM
                    mainWindow.webContents.send('clipboard-updated', { type: 'text', content: currentText });
                }
                return;
            }

            // 2. HEAVY PATH: Buffer-level comparison to avoid toDataURL blocking
            if (formats.includes('image/png') || formats.includes('image/jpeg')) {
                const currentImage = clipboard.readImage();
                if (!currentImage.isEmpty()) {
                    const bmp = currentImage.toBitmap(); // FAST: raw uncompressed memory

                    // memcmp check: ONLY run expensive compression if raw bytes changed
                    if (!lastClipboardImageBmp || !lastClipboardImageBmp.equals(bmp)) {
                        lastClipboardImageBmp = bmp; // Cache the raw buffer
                        lastClipboardText = '';

                        // EXECUTED ONLY ONCE PER NEW IMAGE
                        const currentDataUrl = currentImage.toDataURL();
                        lastClipboardImageDataUrl = currentDataUrl;

                        if (!mainWindow.isVisible()) {
                            mainWindow.show();
                        }
                        if (mainWindow.isMinimized()) mainWindow.restore();
                        mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
                        mainWindow.focus();

                        mainWindow.webContents.send('clipboard-updated', { type: 'image', content: currentDataUrl });
                    }
                }
            }
        }, isMac ? 1000 : 500);
    }

    function stop() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
        lastClipboardText = '';
        lastClipboardImageDataUrl = '';
        lastClipboardImageBmp = null; // Release raw image cache so the privacy toggle frees RAM
    }

    function markWritten(data: { type: string; content: string }) {
        if (data.type === 'text') {
            lastClipboardText = data.content;
            lastClipboardImageBmp = null;
        } else if (data.type === 'image') {
            lastClipboardImageDataUrl = data.content;
        }
    }

    return { start, stop, markWritten };
}
