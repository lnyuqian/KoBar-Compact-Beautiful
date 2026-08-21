import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { translations } from '../i18n/translations';
import type { TranslationKeys } from '../i18n/translations';
export type ThemeName = 'ember' | 'ocean' | 'sakura' | 'emerald' | 'midnight' | 'amethyst' | 'crimson' | 'nord' | 'coffee' | 'lavender' | 'custom';

// ─── Custom Theme Color → CSS Variables Generator ───
function hexToHSL(hex: string): { h: number; s: number; l: number } {
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
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export function applyCustomThemeCSS(primaryHex: string) {
    const { h, s } = hexToHSL(primaryHex);
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', primaryHex);
    root.style.setProperty('--theme-bg-dark', hslToHex(h, Math.min(s, 15), 8));
    root.style.setProperty('--theme-bg-base', hslToHex(h, Math.min(s, 15), 11));
    root.style.setProperty('--theme-bg-light', hslToHex(h, Math.min(s, 20), 96));
    root.style.setProperty('--theme-border', hslToHex(h, Math.min(s, 25), 22));
    root.style.setProperty('--theme-surface', hslToHex(h, Math.min(s, 15), 5));
    const { h: pH, s: pS, l: pL } = hexToHSL(primaryHex);
    root.style.setProperty('--theme-accent-glow', `hsla(${pH}, ${pS}%, ${pL}%, 0.15)`);
    root.style.setProperty('--theme-scrollbar', hslToHex(h, Math.min(s, 25), 22));
    root.style.setProperty('--theme-marker', primaryHex);
}

function clearCustomThemeCSS() {
    const root = document.documentElement;
    const props = ['--theme-primary', '--theme-bg-dark', '--theme-bg-base', '--theme-bg-light', '--theme-border', '--theme-surface', '--theme-accent-glow', '--theme-scrollbar', '--theme-marker'];
    props.forEach(p => root.style.removeProperty(p));
}

export interface Note {
    id: number;
    title: string;
    icon: string;
    emoji: string | null;
    content: string;
    isSettings?: boolean;
}

export interface FavoriteNote {
    id: number;
    title: string;
    content: string;
    createdAt: number;
}

export interface PinnedApp {
    id: string;
    name: string;
    path: string;
    icon: string;
    tag?: string;
}

export interface WorkspaceConfig {
    id: string;
    name: string;



    isPinInjectorEnabled: boolean;
    isKoBoxEnabled: boolean;



    koBoxCleanupMode: '24h' | 'quit';

    toggleWidth: number;
    sidebarWidth: number;
    iconScale: number;
    featureSpacing: number;
    showTooltips: boolean;
    theme: ThemeName;
    customThemeColor: string;
    design: 'style1' | 'style2';
    glassOpacity: number;
    edgePosition: 'left' | 'right' | 'top' | 'bottom';
    enableEyeAnimation: boolean;
    orientation: 'vertical' | 'horizontal';
}

interface AppState {
    isMac: boolean;
    edgePosition: 'left' | 'right' | 'top' | 'bottom';
    setEdgePosition: (edge: 'left' | 'right' | 'top' | 'bottom') => void;
    orientation: 'vertical' | 'horizontal';
    setOrientation: (orientation: 'vertical' | 'horizontal') => void;
    isNotePanelOpen: boolean;
    setNotePanelOpen: (isOpen: boolean) => void;
    toggleNotePanel: () => void;
    isHydrated: boolean;
    setHydrated: (isHydrated: boolean) => void;
    notePanelWidth: number;
    setNotePanelWidth: (width: number | ((prev: number) => number)) => void;
    notePanelHeight: number;
    setNotePanelHeight: (height: number | ((prev: number) => number)) => void;
    // Mini Mode
    isMiniMode: boolean;
    miniModePosition: { x: number, y: number } | null;
    setMiniMode: (isMini: boolean, pos?: { x: number, y: number }) => void;
    // Sidebar Position (null = auto edge-snap, {x,y} = free floating)
    sidebarPosition: { x: number, y: number } | null;
    setSidebarPosition: (pos: { x: number, y: number } | null) => void;
    // Note management
    notes: Note[];
    activeNoteId: number;
    nextNoteId: number;
    setActiveNoteId: (id: number) => void;

    // Eye Notification

    addNote: () => void;
    deleteNote: (id: number) => void;
    updateNoteContent: (id: number, content: string) => void;
    updateNoteTitle: (id: number, title: string) => void;
    updateNoteEmoji: (id: number, emoji: string) => void;
    openSettingsTab: () => void;
    // Favorites (permanently saved documents)
    favorites: FavoriteNote[];
    toggleFavorite: (noteId: number) => void;
    deleteFavorite: (favId: number) => void;
    openFavorite: (favId: number) => void;
    // Editor mode (not persisted): true = editing (CodeMirror), false = reading
    isEditing: boolean;
    setIsEditing: (editing: boolean) => void;
    // App Launcher

    // Theme
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    customThemeColor: string;
    setCustomThemeColor: (color: string) => void;
    // Design System
    design: 'style1' | 'style2';
    setDesign: (design: 'style1' | 'style2') => void;
    glassOpacity: number;
    setGlassOpacity: (val: number) => void;
    // Settings
    showTooltips: boolean;
    setShowTooltips: (val: boolean) => void;
    sidebarWidth: number;
    setSidebarWidth: (val: number) => void;
    lastSidebarHeight: number;
    setLastSidebarHeight: (val: number) => void;
    lastSidebarWidth: number;
    setLastSidebarWidth: (val: number) => void;
    iconScale: number;
    setIconScale: (val: number) => void;

    isDraggingGlobal: boolean;
    setIsDraggingGlobal: (val: boolean) => void;

    // Teleport
    teleportShortcut: string;
    setTeleportShortcut: (val: string) => void;

    // Layout Context
    screenBounds: { x: number, y: number, width: number, height: number } | null;
    setScreenBounds: (bounds: any) => void;
    sidebarAnchorRect: { top: number, left: number, bottom: number, right: number, width: number, height: number } | null;
    setSidebarAnchorRect: (rect: any) => void;

    // Feature Toggles



    isPinInjectorEnabled: boolean;
    setIsPinInjectorEnabled: (val: boolean) => void;
    isTargetingMode: boolean;
    setIsTargetingMode: (val: boolean) => void;
    pinnedWindowHwnd: number | null;
    setPinnedWindowHwnd: (hwnd: number | null) => void;

    // KoBox feature
    isKoBoxEnabled: boolean;
    setIsKoBoxEnabled: (val: boolean) => void;
    koBoxCleanupMode: '24h' | 'quit';
    setKoBoxCleanupMode: (val: '24h' | 'quit') => void;







    // UI Spacing & Sizing
    toggleWidth: number;
    setToggleWidth: (val: number) => void;
    featureSpacing: number;
    setFeatureSpacing: (val: number) => void;

    // Editor Typography
    editorFontSize: number;
    setEditorFontSize: (val: number) => void;
    editorLineHeight: number;
    setEditorLineHeight: (val: number) => void;



    // Eye animation (visual feature, kept enabled)
    enableEyeAnimation: boolean;
    setEnableEyeAnimation: (val: boolean) => void;
    // Default folder for saving notes as text files (empty = system default)
    noteSavePath: string;
    setNoteSavePath: (path: string) => void;
    t: (key: TranslationKeys) => string;

    currentMedia: MediaData | null;
    setCurrentMedia: (data: MediaData | null) => void;
    activeVideoUrls: string[];
    setActiveVideoUrls: (urls: string[]) => void;
    currentMediaSourceApp: string;
    setCurrentMediaSourceApp: (app: string) => void;

    isLicensed: boolean;
    setLicensed: (val: boolean) => void;

    // Scroll Memory (volatile)
    scrollPositions: Record<string, number>;
    setScrollPosition: (key: string, pos: number) => void;
    // Workspaces
    workspaces: WorkspaceConfig[];
    saveCurrentAsWorkspace: (name: string) => void;
    loadWorkspace: (id: string) => void;
    deleteWorkspace: (id: string) => void;
    updateWorkspaceName: (id: string, newName: string) => void;
    updateWorkspaceSettings: (id: string) => void;
}

const defaultNotes: Note[] = [
    {
        id: 1,
        title: '欢迎使用 KoBar！',
        icon: 'waving_hand',
        emoji: '👋',
        content: `<p><strong>你的模块化、始终置顶的桌面笔记侧边栏。</strong></p>
<p>一个轻量、简洁的笔记工具，常驻你的屏幕边缘，随时记录灵感。</p>
<br>
<p><strong>📝 笔记管理</strong></p>
<ul>
    <li>⭐ <strong>收藏：</strong> 点击笔记标签左侧的星形图标即可收藏或取消收藏，收藏的笔记会出现在收藏列表中。</li>
    <li>✖️ <strong>删除：</strong> 将鼠标悬停在笔记标签上，点击右上角的 × 图标即可删除该笔记。</li>
    <li>📑 <strong>双列标签：</strong> 所有笔记以双列选项卡的形式展示，点击即可快速切换。</li>
</ul>
<br>
<p><strong>🛠 快捷操作（面板底部按钮行）</strong></p>
<ul>
    <li>➕ <strong>添加新笔记：</strong> 一键创建空白笔记。</li>
    <li>📖 <strong>阅读 / ✏️ 编辑模式：</strong> 在阅读模式和 Markdown 编辑模式之间切换。编辑模式下支持标题、列表、加粗、文字颜色、图片等富文本格式。</li>
    <li>⭐ <strong>收藏列表：</strong> 查看并管理所有已收藏的笔记。</li>
    <li>📋 <strong>复制整个笔记：</strong> 将当前笔记的全部内容复制到剪贴板。</li>
    <li>⚙️ <strong>设置：</strong> 打开设置面板。</li>
</ul>
<br>
<p><strong>⚙️ 设置面板</strong></p>
<ul>
    <li>📂 <strong>文档保存路径：</strong> 设置笔记自动导出到本地文件夹的位置，或恢复为系统默认（文档目录）。</li>
    <li>🎨 <strong>UI 布局设置：</strong> 调整侧边栏方向、宽度、图标大小、功能间距、编辑器字体大小与行高等。</li>
</ul>
<br>
<p>尽情使用 KoBar！🚀</p>`
    }
];

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            isMac: window.api?.getPlatform ? window.api.getPlatform() === 'darwin' : false,
            edgePosition: 'right',
            setEdgePosition: (edge) => set({ edgePosition: edge }),
            orientation: 'vertical',
            setOrientation: (orientation) => {
                const defaultEdge = orientation === 'horizontal' ? 'bottom' : 'right';
                set({ orientation, edgePosition: defaultEdge, sidebarPosition: null });
            },
            isNotePanelOpen: false,
            setNotePanelOpen: (isOpen) => set({ isNotePanelOpen: isOpen }),
            toggleNotePanel: () => set((state) => ({ isNotePanelOpen: !state.isNotePanelOpen })),
            isHydrated: false,
            setHydrated: (isHydrated) => set({ isHydrated }),
            notePanelWidth: 400,
            setNotePanelWidth: (width) => set((state) => ({ notePanelWidth: typeof width === 'function' ? width(state.notePanelWidth) : width })),
            notePanelHeight: 600,
            setNotePanelHeight: (height) => set((state) => ({ notePanelHeight: typeof height === 'function' ? height(state.notePanelHeight) : height })),

            // Sidebar Position (null = auto edge-snap, {x,y} = free floating)
            sidebarPosition: null,
            setSidebarPosition: (pos) => set({ sidebarPosition: pos }),



            // Theme
            theme: 'amethyst',
            customThemeColor: '#f4a125',
            setTheme: (theme) => {
                if (theme === 'custom') {
                    document.documentElement.setAttribute('data-theme', 'custom');
                    applyCustomThemeCSS(get().customThemeColor);
                } else {
                    clearCustomThemeCSS();
                    document.documentElement.setAttribute('data-theme', theme);
                }
                set({ theme });
            },
            setCustomThemeColor: (color: string) => {
                const hex = color.startsWith('#') ? color : `#${color}`;
                // Double safety: Manual sync write to bypass any async persist issues
                localStorage.setItem('kobar_force_theme_color', hex);

                document.documentElement.setAttribute('data-theme', 'custom');
                applyCustomThemeCSS(hex);
                set({
                    customThemeColor: hex,
                    theme: 'custom'
                });
            },

            // Design System
            design: 'style2',
            setDesign: (design) => {
                document.documentElement.setAttribute('data-design', design);
                set({ design });
            },
            glassOpacity: 60,
            setGlassOpacity: (val) => set({ glassOpacity: val }),

            // Settings
            showTooltips: true,
            setShowTooltips: (val) => set({ showTooltips: val }),
            sidebarWidth: 46,
            setSidebarWidth: (val) => set({ sidebarWidth: val }),
            lastSidebarHeight: 800,
            setLastSidebarHeight: (val) => set({ lastSidebarHeight: val }),
            lastSidebarWidth: 200,
            setLastSidebarWidth: (val) => set({ lastSidebarWidth: val }),
            iconScale: 0.8,
            setIconScale: (val) => set({ iconScale: val }),

            isDraggingGlobal: false,
            setIsDraggingGlobal: (val) => set({ isDraggingGlobal: val }),

            teleportShortcut: 'CommandOrControl+Shift+K',
            setTeleportShortcut: (val) => {
                set({ teleportShortcut: val });
                window.api?.registerTeleportShortcut?.(val);
            },

            screenBounds: null,
            setScreenBounds: (bounds) => set({ screenBounds: bounds }),
            sidebarAnchorRect: null,
            setSidebarAnchorRect: (rect) => set({ sidebarAnchorRect: rect }),

            // Feature Toggles (Initial State)

            isPinInjectorEnabled: false,
            setIsPinInjectorEnabled: (val: boolean) => set({ isPinInjectorEnabled: val }),

            isTargetingMode: false,
            setIsTargetingMode: (val: boolean) => set({ isTargetingMode: val }),
            pinnedWindowHwnd: null,
            setPinnedWindowHwnd: (hwnd: number | null) => set({ pinnedWindowHwnd: hwnd }),

            isKoBoxEnabled: false,
            setIsKoBoxEnabled: (val: boolean) => set({ isKoBoxEnabled: val }),
            koBoxCleanupMode: '24h',
            setKoBoxCleanupMode: (val: '24h' | 'quit') => set({ koBoxCleanupMode: val }),








            // UI Spacing & Sizing (defaults)
            toggleWidth: 22, // Note Notch Protrusion
            setToggleWidth: (val) => set({ toggleWidth: val }),
            featureSpacing: 8, // Feature Spacing
            setFeatureSpacing: (val) => set({ featureSpacing: val }),

            // Editor Typography
            editorFontSize: 14, // px
            setEditorFontSize: (val) => set({ editorFontSize: val }),
            editorLineHeight: 1.4,
            setEditorLineHeight: (val) => set({ editorLineHeight: val }),

            // Eye animation (visual feature, kept enabled)
            enableEyeAnimation: true,
            setEnableEyeAnimation: (val) => set({ enableEyeAnimation: val }),

            noteSavePath: '',
            setNoteSavePath: (path) => set({ noteSavePath: path }),
            t: (key) => translations.zh[key] || key,

            // Mini Mode
            isMiniMode: false,
            miniModePosition: null,
            setMiniMode: (isMini, pos) => set((state) => {
                const updates: Partial<AppState> = { isMiniMode: isMini };
                if (pos) {
                    updates.miniModePosition = pos;
                    if (!isMini) {
                        if (state.orientation === 'horizontal') {
                            // In horizontal mode, the static utilities (like the Eye button) are on the far right.
                            // The eye button itself has a width of 48px, so its half-width is 24 * iconScale.
                            // The horizontal container has a right padding of pr-2 (8px).
                            // Thus, the distance from the center of the eye to the rightmost edge of the sidebar is:
                            const centerToRight = (24 * state.iconScale) + 8;
                            const sidebarY = pos.y - (state.sidebarWidth / 2);
                            updates.sidebarPosition = {
                                x: pos.x - state.lastSidebarWidth + centerToRight,
                                y: sidebarY
                            };

                            // Recalculate edgePosition so NotePanel/SettingsPanel opens on the correct side
                            const screenH = state.screenBounds?.height ?? 800;
                            const sidebarCenterY = sidebarY + (state.sidebarWidth / 2);
                            updates.edgePosition = sidebarCenterY < (screenH / 2) ? 'top' : 'bottom';
                        } else {
                            // Position the sidebar's bottom handle precisely where the eye was located
                            // We subtract lastSidebarHeight so the bottom of the sidebar rests at the eye's Y pos
                            // The eye button itself has a height of 48px, so its half-height is 24 * iconScale.
                            // We add the bottom padding (8px from pb-2) to get the exact distance from the center of the button to the bottom of the sidebar.
                            const centerToBottom = (24 * state.iconScale) + 8;
                            const sidebarX = pos.x - (state.sidebarWidth / 2);
                            updates.sidebarPosition = {
                                x: sidebarX,
                                y: pos.y - state.lastSidebarHeight + centerToBottom
                            };

                            // Recalculate edgePosition so NotePanel/SettingsPanel opens on the correct side.
                            // The window is anchored to the primary display, so its center is exactly
                            // half of the visible screen width -- works at any resolution.
                            const screenW = state.screenBounds?.width ?? window.innerWidth;
                            const screenCenter = screenW / 2;
                            const sidebarCenterX = sidebarX + (state.sidebarWidth / 2);
                            updates.edgePosition = sidebarCenterX < screenCenter ? 'left' : 'right';
                        }
                    }
                } else if (!pos && isMini) {
                    updates.miniModePosition = null;
                }
                return updates;
            }),
            notes: defaultNotes,
            activeNoteId: 1,
            nextNoteId: 2,
            setActiveNoteId: (id) => set({ activeNoteId: id }),

            addNote: () => set((state) => {
                const newNote: Note = {
                    id: state.nextNoteId,
                    title: state.t('addNewNote'),
                    icon: 'note',
                    emoji: null,
                    content: '',
                };
                return {
                    notes: [...state.notes, newNote],
                    activeNoteId: newNote.id,
                    nextNoteId: state.nextNoteId + 1,
                };
            }),
            deleteNote: (id) => set((state) => {
                const filtered = state.notes.filter(n => n.id !== id);
                if (filtered.length === 0) return state;
                const newActiveId = state.activeNoteId === id
                    ? filtered[0].id
                    : state.activeNoteId;
                return { notes: filtered, activeNoteId: newActiveId };
            }),
            updateNoteContent: (id, content) => set((state) => ({
                notes: state.notes.map(n => n.id === id ? { ...n, content } : n),
            })),
            updateNoteTitle: (id, title) => set((state) => ({
                notes: state.notes.map(n => n.id === id ? { ...n, title } : n),
            })),
            updateNoteEmoji: (id, emoji) => set((state) => ({
                notes: state.notes.map(n => n.id === id ? { ...n, emoji } : n),
            })),
            openSettingsTab: () => set((state) => {
                let settingsNote = state.notes.find(n => n.isSettings);
                let nextNotes = state.notes;
                let nextId = state.nextNoteId;

                if (!settingsNote) {
                    settingsNote = {
                        id: state.nextNoteId,
                        title: state.t('settings'),
                        icon: 'settings',
                        emoji: null,
                        content: '',
                        isSettings: true,
                    };
                    nextNotes = [...state.notes, settingsNote];
                    nextId++;
                }

                return {
                    isNotePanelOpen: true,
                    notes: nextNotes,
                    activeNoteId: settingsNote.id,
                    nextNoteId: nextId,
                };
            }),
            // Favorites: permanently saved documents that survive tab deletion
            favorites: [],
            isEditing: false,
            setIsEditing: (editing) => set({ isEditing: editing }),
            toggleFavorite: (noteId) => set((state) => {
                const note = state.notes.find(n => n.id === noteId);
                if (!note || note.isSettings) return state;
                const exists = state.favorites.some(f => f.id === noteId);
                if (exists) {
                    return { favorites: state.favorites.filter(f => f.id !== noteId) };
                }
                return {
                    favorites: [...state.favorites, {
                        id: noteId,
                        title: note.title,
                        content: note.content,
                        createdAt: Date.now(),
                    }],
                };
            }),
            deleteFavorite: (favId) => set((state) => ({
                favorites: state.favorites.filter(f => f.id !== favId),
            })),
            openFavorite: (favId) => set((state) => {
                const fav = state.favorites.find(f => f.id === favId);
                if (!fav) return state;
                const existing = state.notes.find(n => n.id === favId);
                if (existing) {
                    return { isNotePanelOpen: true, activeNoteId: favId };
                }
                const newNote: Note = {
                    id: favId,
                    title: fav.title,
                    icon: 'star',
                    emoji: null,
                    content: fav.content,
                };
                return {
                    isNotePanelOpen: true,
                    notes: [...state.notes, newNote],
                    activeNoteId: favId,
                    nextNoteId: Math.max(state.nextNoteId, favId + 1),
                };
            }),

            currentMedia: null,
            setCurrentMedia: (data) => set({ currentMedia: data }),
            activeVideoUrls: [],
            setActiveVideoUrls: (urls) => set({ activeVideoUrls: urls }),
            currentMediaSourceApp: '',
            setCurrentMediaSourceApp: (app) => set({ currentMediaSourceApp: app }),

            // License
            isLicensed: false,
            setLicensed: (val) => set({ isLicensed: val }),

            // Scroll Memory
            scrollPositions: {},
            setScrollPosition: (key: string, pos: number) => set((state) => ({
                scrollPositions: { ...state.scrollPositions, [key]: pos }
            })),

            // Workspaces
            workspaces: [],
            saveCurrentAsWorkspace: (name) => set((state) => {
                const newWorkspace: WorkspaceConfig = {
                    id: Date.now().toString(),
                    name,

                    isPinInjectorEnabled: state.isPinInjectorEnabled,
                    isKoBoxEnabled: state.isKoBoxEnabled,



                    koBoxCleanupMode: state.koBoxCleanupMode,

                    toggleWidth: state.toggleWidth,
                    sidebarWidth: state.sidebarWidth,
                    iconScale: state.iconScale,
                    featureSpacing: state.featureSpacing,
                    showTooltips: state.showTooltips,
                    theme: state.theme,
                    customThemeColor: state.customThemeColor,
                    design: state.design,
                    glassOpacity: state.glassOpacity,
                    edgePosition: state.edgePosition,
                    enableEyeAnimation: state.enableEyeAnimation,
                    orientation: state.orientation
                };
                return { workspaces: [...state.workspaces, newWorkspace] };
            }),
            loadWorkspace: (id) => set((state) => {
                const ws = state.workspaces.find(w => w.id === id);
                if (!ws) return state;
                document.documentElement.setAttribute('data-theme', ws.theme);
                document.documentElement.setAttribute('data-design', ws.design);
                if (ws.theme === 'custom' && ws.customThemeColor) {
                    applyCustomThemeCSS(ws.customThemeColor);
                } else {
                    clearCustomThemeCSS();
                }
                return {

                    isPinInjectorEnabled: ws.isPinInjectorEnabled,
                    isKoBoxEnabled: ws.isKoBoxEnabled,



                    koBoxCleanupMode: ws.koBoxCleanupMode,

                    toggleWidth: ws.toggleWidth,
                    sidebarWidth: ws.sidebarWidth,
                    iconScale: ws.iconScale,
                    featureSpacing: ws.featureSpacing,
                    showTooltips: ws.showTooltips,
                    theme: ws.theme,
                    customThemeColor: ws.customThemeColor || state.customThemeColor,
                    design: ws.design,
                    glassOpacity: ws.glassOpacity,
                    edgePosition: ws.edgePosition,
                    enableEyeAnimation: ws.enableEyeAnimation !== undefined ? ws.enableEyeAnimation : true,
                    orientation: ws.orientation || 'vertical'
                };
            }),
            deleteWorkspace: (id) => set((state) => ({
                workspaces: state.workspaces.filter(w => w.id !== id)
            })),
            updateWorkspaceName: (id, newName) => set((state) => ({
                workspaces: state.workspaces.map(w => w.id === id ? { ...w, name: newName } : w)
            })),
            updateWorkspaceSettings: (id) => set((state) => ({
                workspaces: state.workspaces.map(w => w.id === id ? {
                    ...w,

                    isPinInjectorEnabled: state.isPinInjectorEnabled,
                    isKoBoxEnabled: state.isKoBoxEnabled,


                    koBoxCleanupMode: state.koBoxCleanupMode,

                    toggleWidth: state.toggleWidth,
                    sidebarWidth: state.sidebarWidth,
                    iconScale: state.iconScale,
                    featureSpacing: state.featureSpacing,
                    showTooltips: state.showTooltips,
                    theme: state.theme,
                    customThemeColor: state.customThemeColor,
                    design: state.design,
                    glassOpacity: state.glassOpacity,
                    edgePosition: state.edgePosition,
                    enableEyeAnimation: state.enableEyeAnimation,
                    orientation: state.orientation
                } : w)
            })),
        }),
        {
            name: 'kobar-storage',
            version: 23,
            migrate: (persistedState: any, version: number) => {
                // version 23 migration: unified editor typography defaults (14px / 1.4)
                if (version <= 22) {
                    persistedState.editorFontSize = 14;
                    persistedState.editorLineHeight = 1.4;
                }
                // version 22 migration: remove plugin system, add favorites
                if (version <= 21) {
                    if (persistedState.favorites === undefined) {
                        persistedState.favorites = [];
                    }
                    if (Array.isArray(persistedState.notes)) {
                        persistedState.notes = persistedState.notes.filter((n: any) => !n.isPlugins);
                        if (persistedState.notes.length === 0) {
                            persistedState.notes = defaultNotes;
                        }
                        if (!persistedState.notes.some((n: any) => n.id === persistedState.activeNoteId)) {
                            persistedState.activeNoteId = persistedState.notes[0].id;
                        }
                    }
                }
                // version 21 migration for editor typography settings
                if (version <= 20) {
                    if (persistedState.editorFontSize === undefined) {
                        persistedState.editorFontSize = 14;
                    }
                    if (persistedState.editorLineHeight === undefined) {
                        persistedState.editorLineHeight = 1.4;
                    }
                }
                // version 18 migration for orientation
                if (version <= 17) {
                    if (persistedState.orientation === undefined) {
                        persistedState.orientation = 'vertical';
                    }
                    if (persistedState.edgePosition === undefined) {
                        persistedState.edgePosition = 'right';
                    }
                }
                // version 17 migration for enableEyeAnimation
                if (version <= 16) {
                    if (persistedState.enableEyeAnimation === undefined) {
                        persistedState.enableEyeAnimation = true;
                    }
                }
                if (version <= 12) {
                    if (persistedState.workspaces === undefined) {
                        persistedState.workspaces = [];
                    }
                }




                delete persistedState.isColorPickerEnabled;
                delete persistedState.colorPalettes;
                delete persistedState.currentColor;



                delete persistedState.isTodoListEnabled;
                delete persistedState.todos;

                // version 3 migration for pininjector
                if (version <= 3) {
                    if (persistedState.isPinInjectorEnabled === undefined) {
                        persistedState.isPinInjectorEnabled = true;
                    }
                }




                // version 4 migration for kobox
                if (version <= 4) {
                    if (persistedState.isKoBoxEnabled === undefined) {
                        persistedState.isKoBoxEnabled = true;
                    }
                    if (persistedState.koBoxCleanupMode === undefined) {
                        persistedState.koBoxCleanupMode = '24h';
                    }
                }

                // version 5/6 migration for snippetvault
                if (version <= 5) {
                    if (persistedState.isSnippetVaultEnabled === undefined) {
                        persistedState.isSnippetVaultEnabled = true;
                    }
                    if (persistedState.snippets === undefined) {
                        persistedState.snippets = [];
                    }
                }

                // version 14 migration for snippet passwords
                if (version <= 13) {
                    if (persistedState.snippets) {
                        persistedState.snippets = persistedState.snippets.map((s: any) => ({
                            ...s,
                            password: s.password || undefined
                        }));
                    }
                }

                // version 15 migration for snippet colors
                if (version <= 14) {
                    if (persistedState.snippets) {
                        persistedState.snippets = persistedState.snippets.map((s: any) => ({
                            ...s,
                            color: s.color || undefined
                        }));
                    }
                }


                // version 16 migration for custom theme
                if (version <= 15) {
                    if (persistedState.customThemeColor === undefined) {
                        persistedState.customThemeColor = '#f4a125';
                    }
                }

                return persistedState;
            },
            partialize: (state) => ({
                notes: state.notes,
                activeNoteId: state.activeNoteId,
                nextNoteId: state.nextNoteId,
                favorites: state.favorites,
                notePanelWidth: state.notePanelWidth,
                notePanelHeight: state.notePanelHeight,

                theme: state.theme,
                customThemeColor: state.customThemeColor,
                showTooltips: state.showTooltips,
                sidebarWidth: state.sidebarWidth,
                iconScale: state.iconScale,
                teleportShortcut: state.teleportShortcut,
                enableEyeAnimation: state.enableEyeAnimation,
                noteSavePath: state.noteSavePath,







                isPinInjectorEnabled: state.isPinInjectorEnabled,
                isKoBoxEnabled: state.isKoBoxEnabled,

                koBoxCleanupMode: state.koBoxCleanupMode,




                design: state.design,
                glassOpacity: state.glassOpacity,

                editorFontSize: state.editorFontSize,
                editorLineHeight: state.editorLineHeight,



                workspaces: state.workspaces,

                orientation: state.orientation,
                edgePosition: state.edgePosition,
            }),
            onRehydrateStorage: () => {
                console.log('[Store] Hydration starting...');
                return (fetchedState, error) => {
                    if (error) {
                        console.error('[Store] Hydration failed:', error);
                    } else if (fetchedState) {
                        fetchedState.setHydrated(true);

                        // Priority 1: Force color from emergency sync storage
                        const forcedColor = localStorage.getItem('kobar_force_theme_color');

                        if (fetchedState.theme === 'custom') {
                            const finalColor = forcedColor || fetchedState.customThemeColor;
                            if (finalColor) {
                                applyCustomThemeCSS(finalColor);
                            }
                        }
                        console.log('[Store] Hydration complete. Theme:', fetchedState.theme);
                    }
                };
            },
        }
    )
);

