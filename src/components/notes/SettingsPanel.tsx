import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';

const SettingsPanel: React.FC = () => {
    // ─── Granular Selectors (prevents re-render on unrelated store changes) ───
    const t = useAppStore(state => state.t);
    const noteSavePath = useAppStore(state => state.noteSavePath);
    const setNoteSavePath = useAppStore(state => state.setNoteSavePath);
    const design = useAppStore(state => state.design);
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

    const orientation = useAppStore(state => state.orientation);
    const setOrientation = useAppStore(state => state.setOrientation);

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

    return (
        <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto py-4 pb-4 custom-scrollbar relative"
            style={{
                paddingLeft: '2%',
                paddingRight: '2%',
                backgroundColor: design === 'style2' ? 'transparent' : 'var(--theme-bg-base)'
            }}
        >
            {/* --- Document Save Path --- */}
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

            <div className="w-full h-px opacity-20 my-5" style={{ backgroundColor: 'var(--theme-border)' }}></div>

            {/* --- UI Layout Configuration --- */}
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

                <div className="w-full h-px bg-white/5 my-1"></div>
            </div>
        </div>
    );
};

export default SettingsPanel;