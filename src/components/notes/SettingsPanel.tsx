import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, applyCustomThemeCSS } from '../../store/useAppStore';
function hsvToHex(h: number, s: number, v: number): string {
    s /= 100; v /= 100;
    const i = Math.floor(h / 60);
    const f = h / 60 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    let r = 0, g = 0, b = 0;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): [number, number, number] {
    let hexStr = hex;
    if (hexStr.length === 4) {
        hexStr = '#' + hexStr[1] + hexStr[1] + hexStr[2] + hexStr[2] + hexStr[3] + hexStr[3];
    } else if (hexStr.length !== 7) {
        return [0, 0, 100];
    }
    let r = parseInt(hexStr.slice(1, 3), 16) / 255;
    let g = parseInt(hexStr.slice(3, 5), 16) / 255;
    let b = parseInt(hexStr.slice(5, 7), 16) / 255;
    
    if (isNaN(r)) r = 0;
    if (isNaN(g)) g = 0;
    if (isNaN(b)) b = 0;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;

    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    } else {
        h = 0;
    }
    return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}
import { IS_STORE_BUILD } from '../../App';
import Accordion from './Accordion';
const isSystemTab = (note: any) => note.isSettings || note.title === 'Welcome to KoBar!' || note.title === '欢迎使用 KoBar！';

const SettingsPanel: React.FC = () => {
    // ─── Granular Selectors (prevents re-render on unrelated store changes) ───
    const setTheme = useAppStore(state => state.setTheme);
    const customThemeColor = useAppStore(state => state.customThemeColor);
    const setCustomThemeColor = useAppStore(state => state.setCustomThemeColor);
    // Refs for file inputs
    const importSettingsRef = useRef<HTMLInputElement>(null);
    const importDataRef = useRef<HTMLInputElement>(null);


    const t = useAppStore(state => state.t);
    const launchAtStartup = useAppStore(state => state.launchAtStartup);
    const enableEyeAnimation = useAppStore(state => state.enableEyeAnimation);
    const setEnableEyeAnimation = useAppStore(state => state.setEnableEyeAnimation);
    const clipboardMonitoring = useAppStore(state => state.clipboardMonitoring);
    const setClipboardMonitoring = useAppStore(state => state.setClipboardMonitoring);
    const noteSavePath = useAppStore(state => state.noteSavePath);
    const setNoteSavePath = useAppStore(state => state.setNoteSavePath);
    const design = useAppStore(state => state.design);
    const setLaunchAtStartup = useAppStore(state => state.setLaunchAtStartup);
    const toggleWidth = useAppStore(state => state.toggleWidth);
    const setToggleWidth = useAppStore(state => state.setToggleWidth);
    const sidebarWidth = useAppStore(state => state.sidebarWidth);
    const setSidebarWidth = useAppStore(state => state.setSidebarWidth);
    const iconScale = useAppStore(state => state.iconScale);
    const setIconScale = useAppStore(state => state.setIconScale);
    const featureSpacing = useAppStore(state => state.featureSpacing);
    const setFeatureSpacing = useAppStore(state => state.setFeatureSpacing);
    const editorFontSize = useAppStore(state => state.editorFontSize);
    const setEditorFontSize = useAppStore(state => state.setEditorFontSize);
    const editorLineHeight = useAppStore(state => state.editorLineHeight);
    const setEditorLineHeight = useAppStore(state => state.setEditorLineHeight);

    const isPopupSmartPositioning = useAppStore(state => state.isPopupSmartPositioning);
    const setIsPopupSmartPositioning = useAppStore(state => state.setIsPopupSmartPositioning);
    const orientation = useAppStore(state => state.orientation);
    const setOrientation = useAppStore(state => state.setOrientation);
    const setTutorialState = useAppStore(state => state.setTutorialState);
    const setIsManualTutorialTrigger = useAppStore(state => state.setIsManualTutorialTrigger);

    // Top-level states for inline custom color picker
    const [inlineHsv, setInlineHsv] = useState<[number, number, number]>([0, 0, 100]);
    const [isDraggingSat, setIsDraggingSat] = useState(false);
    const [isDraggingHue, setIsDraggingHue] = useState(false);
    const satRectRef = useRef<HTMLDivElement>(null);
    const hueRectRef = useRef<HTMLDivElement>(null);

    // Synchronize local HSV state when theme changes externally
    useEffect(() => {
        if (customThemeColor) {
            setInlineHsv(hexToHsv(customThemeColor));
        }
    }, [customThemeColor]);

    const handleSatMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!satRectRef.current) return;
        const rect = satRectRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
        
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
        
        const newS = Math.round(x * 100);
        const newV = Math.round(y * 100);
        
        setInlineHsv(prev => [prev[0], newS, newV]);
        const newHex = hsvToHex(inlineHsv[0], newS, newV);
        setCustomThemeColor(newHex);
        applyCustomThemeCSS(newHex);
        setTheme('custom');
    };

    const handleHueMove = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!hueRectRef.current) return;
        const rect = hueRectRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newH = Math.round(x * 360);
        
        setInlineHsv(prev => [newH, prev[1], prev[2]]);
        const newHex = hsvToHex(newH, inlineHsv[1], inlineHsv[2]);
        setCustomThemeColor(newHex);
        applyCustomThemeCSS(newHex);
        setTheme('custom');
    };

    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (isDraggingSat) handleSatMove(e);
            if (isDraggingHue) handleHueMove(e);
        };
        const handleGlobalUp = () => {
            setIsDraggingSat(false);
            setIsDraggingHue(false);
        };

        if (isDraggingSat || isDraggingHue) {
            window.addEventListener('mousemove', handleGlobalMove);
            window.addEventListener('mouseup', handleGlobalUp);
            window.addEventListener('touchmove', handleGlobalMove);
            window.addEventListener('touchend', handleGlobalUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalUp);
        };
    }, [isDraggingSat, isDraggingHue, inlineHsv]);

    const [appVersion, setAppVersion] = useState('');
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
    const [latestVersion, setLatestVersion] = useState('');
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [downloadSpeed, setDownloadSpeed] = useState('');
    const [downloadedSize, setDownloadedSize] = useState('');
    const [totalSize, setTotalSize] = useState('');
    const [updateErrorMessage, setUpdateErrorMessage] = useState('');

    useEffect(() => {
        if (IS_STORE_BUILD) return;

        // Subscriptions to Electron auto-updater progress/complete/error IPCs
        let unsubscribeProgress = () => {};
        let unsubscribeComplete = () => {};
        let unsubscribeError = () => {};

        if (window.api?.onUpdateDownloadProgress) {
            unsubscribeProgress = window.api.onUpdateDownloadProgress((progress) => {
                setUpdateStatus('downloading');
                setDownloadPercent(Math.round(progress.percent));
                
                // Bytes per second converted to readable MB/s
                const speedMB = (progress.bytesPerSecond / (1024 * 1024)).toFixed(1);
                setDownloadSpeed(`${speedMB} MB/s`);
                
                // Downloaded & Total sizes in MB
                const transMB = (progress.transferred / (1024 * 1024)).toFixed(1);
                const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
                setDownloadedSize(`${transMB} MB`);
                setTotalSize(`${totalMB} MB`);
            });
        }

        if (window.api?.onUpdateDownloadComplete) {
            unsubscribeComplete = window.api.onUpdateDownloadComplete((version) => {
                setUpdateStatus('downloaded');
                setDownloadPercent(100);
                if (version) setLatestVersion(version);
            });
        }

        if (window.api?.onUpdateError) {
            unsubscribeError = window.api.onUpdateError((err) => {
                setUpdateStatus('error');
                setUpdateErrorMessage(err || '更新下载失败');
            });
        }

        return () => {
            unsubscribeProgress();
            unsubscribeComplete();
            unsubscribeError();
        };
    }, []);

    const handleCheckUpdatesInline = async () => {
        if (updateStatus === 'checking' || updateStatus === 'downloading') return;
        setUpdateStatus('checking');
        setUpdateErrorMessage('');
        
        try {
            const result = await window.api.checkForUpdatesManual();
            
            if (result.status === 'disabled') {
                setUpdateStatus('idle');
                return;
            }

            if (result.status === 'error') {
                setUpdateStatus('error');
                setUpdateErrorMessage(result.message || '未知的更新检查错误');
                return;
            }

            if (result.status === 'success') {
                if (result.updateAvailable && result.version) {
                    setUpdateStatus('available');
                    setLatestVersion(result.version);
                } else {
                    setUpdateStatus('upToDate');
                }
            }
        } catch (err: any) {
            setUpdateStatus('error');
            setUpdateErrorMessage(err?.message || '检查更新失败');
        }
    };

    const handleStartDownloadInline = () => {
        if (window.api?.downloadAndInstallUpdate) {
            setUpdateStatus('downloading');
            setDownloadPercent(0);
            window.api.downloadAndInstallUpdate();
        }
    };

    const handleQuitAndInstallInline = () => {
        if (window.api?.quitAndInstallUpdate) {
            window.api.quitAndInstallUpdate();
        }
    };

    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Restore scroll position on mount — read from store directly (no subscription)
    useEffect(() => {
        const savedPos = useAppStore.getState().scrollPositions['settings'];
        if (scrollRef.current && savedPos) {
            scrollRef.current.scrollTop = savedPos;
        }
    }, []);

    // Debounced scroll position sync — prevents re-render storm
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        clearTimeout(scrollDebounceRef.current);
        scrollDebounceRef.current = setTimeout(() => {
            useAppStore.getState().setScrollPosition('settings', scrollTop);
        }, 250);
    };

    useEffect(() => {
        if (window.api?.getAppVersion) {
            window.api.getAppVersion().then(setAppVersion);
        }
    }, []);

    const handleAutoLaunchToggle = () => {
        setLaunchAtStartup(!launchAtStartup);
    };

    // maxShortcuts handler removed

    const handleToggleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            setToggleWidth(Math.min(40, Math.max(10, val)));
        }
    };

    const handleSidebarWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            setSidebarWidth(Math.min(120, Math.max(40, val)));
        }
    };

    const handleIconScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            setIconScale(Math.min(1.5, Math.max(0.7, val)));
        }
    };

    const handleFeatureSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            setFeatureSpacing(Math.min(50, Math.max(0, val)));
        }
    };

    const handleEditorFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            setEditorFontSize(Math.min(32, Math.max(12, val)));
        }
    };

    const handleEditorLineHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            setEditorLineHeight(Math.min(3, Math.max(1, val)));
        }
    };

    const handleExport = (type: 'settings' | 'data', method: 'download' | 'email') => {
        const state = useAppStore.getState();
        let payload: any = {};
        
        if (type === 'settings') {
            payload = {
                theme: state.theme,
                customThemeColor: state.customThemeColor,
                sidebarWidth: state.sidebarWidth,
                iconScale: state.iconScale,
                teleportShortcut: state.teleportShortcut,
                launchAtStartup: state.launchAtStartup,
                enableEyeAnimation: state.enableEyeAnimation,



                isPinInjectorEnabled: state.isPinInjectorEnabled,
                isKoBoxEnabled: state.isKoBoxEnabled,

                koBoxCleanupMode: state.koBoxCleanupMode,

                design: state.design,
                glassOpacity: state.glassOpacity,


                workspaces: state.workspaces,
                orientation: state.orientation,
                edgePosition: state.edgePosition,
            };
        } else {
            payload = {
                notes: state.notes.filter(n => !isSystemTab(n))
            };
        }

        const jsonString = JSON.stringify(payload, null, 2);

        if (method === 'download') {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kobar-${type}-export.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            window.api?.sendNotification?.('导出完成', `已成功下载${type} 导出文件。`);
        } else if (method === 'email') {
            const subject = encodeURIComponent(`KoBar ${type === 'settings' ? 'Settings' : 'Data'} Export`);
            const body = encodeURIComponent(jsonString);
            window.api?.openExternal(`mailto:?subject=${subject}&body=${body}`);
            window.api?.sendNotification?.('导出就绪', `正在打开邮件客户端发送${type} 导出文件。`);
        }
    };

    const handleImport = (type: 'settings' | 'data', event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonStr = e.target?.result as string;
                const parsed = JSON.parse(jsonStr);
                
                if (typeof parsed !== 'object' || parsed === null) {
                    throw new Error('无效的 JSON 结构');
                }

                if (type === 'data') {
                    const state = useAppStore.getState();
                    
                    let nextId = state.nextNoteId || Math.max(...state.notes.map(n => n.id), 0) + 1;
                    const filteredImportedNotes = (parsed.notes || []).filter((n: any) => !isSystemTab(n));
                    const importedNotes = filteredImportedNotes.map((n: any) => ({ ...n, id: nextId++ }));
                    



                    useAppStore.setState({
                        notes: [...state.notes, ...importedNotes],
                        nextNoteId: nextId
                    });
                } else {
                    // Apply parsed settings directly to the store
                    useAppStore.setState(parsed);
                    
                    // Switch to mini mode and teleport to center as if it's a fresh start.
                    // The window is anchored to the primary display, so the horizontal
                    // center is half of the visible screen width at any resolution.
                    const state = useAppStore.getState();
                    const visibleWidth = state.screenBounds?.width ?? window.innerWidth;
                    const visibleHeight = state.screenBounds?.height ?? 800;
                    state.setMiniMode(true, { 
                        x: Math.floor(visibleWidth / 2), 
                        y: Math.floor(visibleHeight / 2) 
                    });
                }
                
                window.api?.sendNotification?.('导入完成', `已成功导入${type}。`);
            } catch (err) {
                console.error('导入失败', err);
                window.api?.sendNotification?.('导入失败', `无法解析${type} 导入文件。`);
            }
        };
        reader.readAsText(file);
        
        // Reset the input so the same file can be selected again
        event.target.value = '';
    };

    return (
        <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto py-8 pb-4 custom-scrollbar relative" 
            style={{ 
                paddingLeft: '4%', 
                paddingRight: '4%', 
                backgroundColor: design === 'style2' ? 'transparent' : 'var(--theme-bg-base)' 
            }}
        >
            <h2 className="text-2xl font-semibold text-slate-200 mb-8">{t('settings')}</h2>

            <div className="space-y-10">

                {/* --- TOP: Document Save Path --- */}
                <div>
                    <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4 px-2">文档保存路径</h3>
                    <div className="space-y-4">
                        <Accordion title="文档保存路径" icon="folder" defaultOpen={true}>
                            <div className="flex flex-col gap-3">
                                <span className="text-xs text-slate-500">笔记另存为文本文件时的默认保存文件夹。留空则使用系统默认位置（文档目录）。</span>
                                <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">folder</span>
                                    <span className="flex-1 text-xs text-slate-300 font-mono truncate">{noteSavePath || '未设置（默认：文档目录）'}</span>
                                </div>
                                <div className="flex gap-2 mt-1">
                                    <button
                                        onClick={async () => {
                                            const result = await window.api?.selectNoteSaveFolder?.();
                                            if (result && !result.canceled && result.path) {
                                                setNoteSavePath(result.path);
                                            }
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">folder_open</span>
                                        选择文件夹
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const def = await window.api?.getDefaultNoteSavePath?.();
                                            setNoteSavePath(def || '');
                                        }}
                                        className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                        恢复默认
                                    </button>
                                </div>
                            </div>
                        </Accordion>
                    </div>
                </div>

                <div className="w-full h-px opacity-20" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                {/* --- MIDDLE SECTION: Application UI Configuration --- */}
                <div>
                    <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4 px-2">{t('uiLayout')}</h3>
                    <div className="space-y-4">
                        <Accordion title={t('layoutAndSpacing')} icon="grid_view" defaultOpen={true}>
                            <div className="flex flex-col gap-6">
                                <div className="flex flex-col gap-3">
                                    <label className="text-sm text-slate-400 font-medium">{t('orientation') || 'Orientation'}</label>
                                    <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 no-drag-region">
                                        <button onClick={() => setOrientation('vertical')}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${orientation === 'vertical' ? 'bg-primary text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                                            {t('vertical') || 'Vertical'}
                                        </button>
                                        <button onClick={() => setOrientation('horizontal')}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${orientation === 'horizontal' ? 'bg-primary text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>
                                            {t('horizontal') || 'Horizontal'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">{t('toggleWidthConfig')}</label>
                                        <span className="text-base font-bold text-primary">{toggleWidth}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="10"
                                        max="40"
                                        value={toggleWidth}
                                        onChange={handleToggleWidthChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">侧边栏宽度</label>
                                        <span className="text-base font-bold text-primary">{sidebarWidth}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="120"
                                        value={sidebarWidth}
                                        onChange={handleSidebarWidthChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">图标大小</label>
                                        <span className="text-base font-bold text-primary">{Math.round(iconScale * 100)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.7"
                                        max="1.5"
                                        step="0.05"
                                        value={iconScale}
                                        onChange={handleIconScaleChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">{t('featureSpacingConfig')}</label>
                                        <span className="text-base font-bold text-primary">{featureSpacing}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="50"
                                        value={featureSpacing}
                                        onChange={handleFeatureSpacingChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">{t('editorFontSizeConfig')}</label>
                                        <span className="text-base font-bold text-primary">{editorFontSize}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="12"
                                        max="32"
                                        value={editorFontSize}
                                        onChange={handleEditorFontSizeChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm text-slate-400 font-medium">{t('editorLineHeightConfig')}</label>
                                        <span className="text-base font-bold text-primary">{editorLineHeight.toFixed(2)}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="0.05"
                                        value={editorLineHeight}
                                        onChange={handleEditorLineHeightChange}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onTouchStart={(e) => e.stopPropagation()}
                                        onDragStart={(e) => e.stopPropagation()}
                                        draggable={false}
                                        className={`w-full h-2 rounded-lg appearance-none cursor-pointer mt-1 no-drag-region ${design === 'style2' ? 'bg-white/10' : 'bg-slate-700'}`}
                                        style={{ accentColor: 'var(--theme-primary)' }}
                                    />
                                </div>

                                <div className="w-full h-px bg-white/5 my-2"></div>

                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm text-slate-300 font-medium">{t('smartPopupPositioning')}</span>
                                        <span className="text-xs text-slate-500 leading-tight pr-4">{t('smartPopupPositioningDesc')}</span>
                                    </div>
                                    <button
                                        onClick={() => setIsPopupSmartPositioning(!isPopupSmartPositioning)}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 no-drag-region shrink-0 ${isPopupSmartPositioning ? 'bg-primary' : 'bg-slate-600'}`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${isPopupSmartPositioning ? 'translate-x-5' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </div>
                            </div>
                        </Accordion>
                    </div>
                </div>

                <div className="w-full h-px opacity-20" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                {/* --- BOTTOM SECTION: Static Settings --- */}
                <div>
                    <h3 className="text-sm uppercase tracking-wider text-slate-500 font-semibold mb-4 px-2">{t('settings')}</h3>
                    <div className="space-y-4">
                        
                        {/* Theme & Language Settings Area */}
                


                {/* General Settings Area */}
                <Accordion title={t('settings')} icon="tune" defaultOpen={true}>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-[20px]">power_settings_new</span>
                                <span className="text-sm text-slate-300">{t('launchAtStartup')}</span>
                            </div>
                            <button
                                onClick={handleAutoLaunchToggle}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 no-drag-region ${launchAtStartup ? 'bg-primary' : 'bg-slate-600'}`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${launchAtStartup ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>

                        <div className="w-full h-px opacity-50" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-[20px]">visibility</span>
                                <span className="text-sm text-slate-300">{t('enableEyeAnimation')}</span>
                            </div>
                            <button
                                onClick={() => setEnableEyeAnimation(!enableEyeAnimation)}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 no-drag-region ${enableEyeAnimation ? 'bg-primary' : 'bg-slate-600'}`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${enableEyeAnimation ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-[20px]">content_copy</span>
                                <span className="text-sm text-slate-300">{t('clipboardMonitoring') || 'Clipboard Monitoring'}</span>
                            </div>
                            <button
                                onClick={() => setClipboardMonitoring(!clipboardMonitoring)}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 no-drag-region ${clipboardMonitoring ? 'bg-primary' : 'bg-slate-600'}`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${clipboardMonitoring ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>

                        <div className="w-full h-px opacity-50" style={{ backgroundColor: 'var(--theme-border)' }}></div>
                        <div className="w-full h-px opacity-50" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-[20px]">school</span>
                                <span className="text-sm text-slate-300">教程</span>
                            </div>
                            <button
                                onClick={() => {
                                    setIsManualTutorialTrigger(true);
                                    setTutorialState({ status: 'pending', snoozeUntil: undefined });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-xs font-medium no-drag-region cursor-pointer"
                            >
                                {(t as any)('restartTutorial')}
                            </button>
                        </div>

                        
                    </div>
                  </Accordion>

                {/* Update Center Section */}
                {!IS_STORE_BUILD && (
                    <Accordion title={(t as any)('updateCenter') || '更新中心'} icon="update" defaultOpen={false}>
                        <div className="flex flex-col gap-4 no-drag-region">
                            <div className="flex flex-col gap-4">
                                {/* Current version label */}
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{t('version') || 'Version'}</span>
                                    <span className="text-xs font-mono font-semibold text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                        v{appVersion || '...'}
                                    </span>
                                </div>

                                <div className="w-full h-px opacity-30" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                                {/* Custom Inline UI based on updateStatus */}
                                {updateStatus === 'idle' && (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={handleCheckUpdatesInline}
                                            className="w-full py-2.5 px-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 text-primary text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">update</span>
                                            <span>{t('checkForUpdates') as string || 'Check for Updates'}</span>
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'checking' && (
                                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3">
                                        <span className="material-symbols-outlined text-primary text-[24px] animate-spin">sync</span>
                                        <span className="text-xs text-slate-300 font-medium">
                                            {t('checkingForUpdates') as string || 'Checking for updates...'}
                                        </span>
                                    </div>
                                )}

                                {updateStatus === 'upToDate' && (
                                    <div className="flex flex-col gap-4">
                                        <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3">
                                            <span className="material-symbols-outlined text-green-500 text-[20px] shrink-0 mt-0.5">check_circle</span>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-green-400 font-bold">{t('appUpToDate') as string || 'App Up to Date'}</span>
                                                <span className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                                    {t('alreadyLatest') as string || 'You are already using the latest version of KoBar.'}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCheckUpdatesInline}
                                            className="w-full py-2 px-3 rounded-lg border border-slate-700 hover:border-slate-500 bg-slate-800/40 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">sync</span>
                                            <span>{t('checkForUpdates') as string || 'Check Again'}</span>
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'available' && (
                                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex flex-col gap-3.5">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-amber-500 text-[22px] shrink-0 mt-0.5">arrow_circle_down</span>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-amber-400 font-bold">
                                                    {((t as any)('newVersionAvailable') || '新版本可用：v{version}').replace('{version}', latestVersion)}
                                                </span>
                                                <span className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                                    更新已准备就绪，可下载。点击下方按钮开始安装。
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleStartDownloadInline}
                                            className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all duration-300 active:scale-[0.98] border border-primary/30 cursor-pointer"
                                            style={{
                                                background: 'linear-gradient(135deg, var(--theme-primary) 0%, rgba(var(--theme-primary-rgb), 0.8) 100%)'
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">download</span>
                                            <span>{(t as any)('downloadAndInstall') || '下载并安装更新'}</span>
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'downloading' && (
                                    <div className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-slate-300 font-bold flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-primary animate-pulse">downloading</span>
                                                {((t as any)('downloadingUpdate') || '正在下载更新...')}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-primary">{downloadPercent}%</span>
                                        </div>

                                        {/* Premium Progress Bar */}
                                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 relative">
                                            <div 
                                                className="h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(var(--theme-primary-rgb),0.5)] relative overflow-hidden"
                                                style={{ 
                                                    width: `${downloadPercent}%`,
                                                    backgroundColor: 'var(--theme-primary)'
                                                }}
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shine_2s_infinite]"></div>
                                            </div>
                                        </div>

                                        {/* Download Metadata */}
                                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 font-bold px-0.5">
                                            <span>{downloadedSize} of {totalSize}</span>
                                            <span>{downloadSpeed}</span>
                                        </div>
                                    </div>
                                )}

                                {updateStatus === 'downloaded' && (
                                    <div className="p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl flex flex-col gap-3.5">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-green-500 text-[22px] shrink-0 mt-0.5">task_alt</span>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-green-400 font-bold">
                                                    {((t as any)('downloadComplete') || '下载完成！')}
                                                </span>
                                                <span className="text-[11px] text-slate-400 leading-relaxed font-medium">
                                                    {((t as any)('restartInstallDesc') || '更新已下载。重启应用以应用更新。')}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleQuitAndInstallInline}
                                            className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all duration-300 active:scale-[0.98] border border-green-500/30 cursor-pointer"
                                            style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                                            <span>{((t as any)('restartAndInstall') || '立即重启并安装')}</span>
                                        </button>
                                    </div>
                                )}

                                {updateStatus === 'error' && (
                                    <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-3.5">
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-red-500 text-[22px] shrink-0 mt-0.5">error</span>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs text-red-400 font-bold">{t('updateError') as string || 'Update Failed'}</span>
                                                <span className="text-[11px] text-slate-400 leading-relaxed font-medium break-all font-mono">
                                                    {updateErrorMessage}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleCheckUpdatesInline}
                                            className="w-full py-2 px-3 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">sync</span>
                                            <span>{t('checkForUpdates') as string || 'Try Checking Again'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Accordion>
                )}

                {/* Export Data & Settings Section */}
                <Accordion title={t('exportDataSettings') as string || 'Export Data and Settings'} icon="database" defaultOpen={false}>
                    <div className="flex flex-col gap-4 px-1">
                        {/* Export Settings */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm text-slate-300 font-medium">{t('exportSettings') as string || 'Export Settings'}</span>
                                    <span className="text-xs text-slate-500">{t('exportSettingsDesc') as string || 'Backup your layout, themes, and feature toggles.'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => handleExport('settings', 'download')}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">download</span>
                                    {t('downloadJson') as string || '下载 JSON'}
                                </button>
                                <button
                                    onClick={() => handleExport('settings', 'email')}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">mail</span>
                                    {t('sendToEmail') as string || '发送到邮箱'}
                                </button>
                                <input type="file" accept=".json" className="hidden" ref={importSettingsRef} onChange={(e) => handleImport('settings', e)} />
                                <button
                                    onClick={() => importSettingsRef.current?.click()}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">upload</span>
                                    {t('import') as string || '导入'}
                                </button>
                            </div>
                        </div>

                        <div className="w-full h-px opacity-30" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                        {/* Export Data */}
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm text-slate-300 font-medium">{t('exportData') as string || 'Export Data'}</span>
                                    <span className="text-xs text-slate-500">{t('exportDataDesc') as string || 'Backup your notes, calendar events, to-dos, and snippets.'}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => handleExport('data', 'download')}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">download</span>
                                    {t('downloadJson') as string || '下载 JSON'}
                                </button>
                                <button
                                    onClick={() => handleExport('data', 'email')}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">mail</span>
                                    {t('sendToEmail') as string || '发送到邮箱'}
                                </button>
                                <input type="file" accept=".json" className="hidden" ref={importDataRef} onChange={(e) => handleImport('data', e)} />
                                <button
                                    onClick={() => importDataRef.current?.click()}
                                    className="flex-1 py-2 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 hover:border-primary/50 text-slate-300 hover:text-primary text-xs font-medium flex items-center justify-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-[16px]">upload</span>
                                    {t('import') as string || '导入'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Accordion>

                {/* About Section */}
                <Accordion title={t('about')} icon="help_outline" defaultOpen={false}>
                    <div className="flex flex-col gap-5 px-1">
                        <div className="flex flex-col gap-2">
                            <span className="text-sm text-slate-300 font-medium">{t('aboutMaker')}</span>
                            <span className="text-xs text-slate-500 leading-relaxed font-medium">{t('aboutCredits')}</span>
                            <span className="text-xs text-slate-500 leading-relaxed font-medium">
                                {t('aboutContributors')}{' '}
                                <button
                                    onClick={() => window.api?.openExternal('https://github.com/arindam-sahoo')}
                                    className="text-primary hover:underline font-semibold transition-all cursor-pointer"
                                >
                                    Arindam Sahoo
                                </button>
                            </span>
                        </div>
                        
                        <div className="w-full h-px opacity-30" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                        <div className="flex flex-col gap-2">
                             <p className="text-xs text-slate-400 leading-relaxed">
                                {t('aboutContact')}
                                <button 
                                    onClick={() => window.api?.openExternal('mailto:hello@kobar.org')}
                                    className="text-primary hover:underline ml-1 font-semibold transition-all cursor-pointer"
                                >
                                    hello@kobar.org
                                </button>
                            </p>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                {t('aboutWebsite')}
                                <button 
                                    onClick={() => window.api?.openExternal('https://kobar.org')}
                                    className="text-primary hover:underline ml-1 font-semibold transition-all cursor-pointer"
                                >
                                    kobar.org
                                </button>
                            </p>
                        </div>

                        <div className="pt-2 flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">{t('version')}</span>
                            <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">{appVersion || '...'}</span>
                        </div>
                        
                        <div className="pt-1 flex gap-2">
                            <button
                                onClick={() => window.api?.openExternal('https://patreon.com/kobarproject')}
                                className="flex-1 py-2.5 px-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 shadow-lg transition-all duration-300 active:scale-[0.98] border border-[#FF424D]/30 cursor-pointer"
                                style={{ background: 'linear-gradient(135deg, #FF424D 0%, #D8313A 100%)' }}
                            >
                                <span className="material-symbols-outlined text-[16px]">favorite</span>
                                <span className="truncate">Patreon</span>
                            </button>
                            <button
                                onClick={() => window.api?.openExternal('https://opencollective.com/kobar')}
                                className="flex-1 py-2.5 px-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 shadow-lg transition-all duration-300 active:scale-[0.98] border border-[#7DB343]/30 cursor-pointer"
                                style={{ background: 'linear-gradient(135deg, #97CC5D 0%, #7DB343 100%)' }}
                            >
                                <span className="material-symbols-outlined text-[16px]">volunteer_activism</span>
                                <span className="truncate">Open Collective</span>
                            </button>
                        </div>
                    </div>
                </Accordion>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
