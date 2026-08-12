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

export interface EyeNotificationButton {
    label: string;
    color: string;
    onClick: () => void;
}

export interface EyeNotificationData {
    isVisible: boolean;
    message: string;
    buttons?: EyeNotificationButton[];
}

export interface PinnedApp {
    id: string;
    name: string;
    path: string;
    icon: string;
    tag?: string;
}

export interface TutorialState {
    version: string;
    status: 'pending' | 'completed' | 'snoozed';
    snoozeUntil?: number;
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
    isPopupSmartPositioning: boolean;
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

    // Tutorial State
    tutorialState: TutorialState;
    setTutorialState: (state: Partial<TutorialState>) => void;
    isManualTutorialTrigger: boolean;
    setIsManualTutorialTrigger: (val: boolean) => void;
    isHighlightingToggleNotes: boolean;
    setIsHighlightingToggleNotes: (val: boolean) => void;
    isHighlightingSettingsBtn: boolean;
    setIsHighlightingSettingsBtn: (val: boolean) => void;

    // Eye Notification
    eyeNotification: EyeNotificationData | null;
    showEyeNotification: (data: Omit<EyeNotificationData, 'isVisible'>) => void;
    hideEyeNotification: () => void;
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







    isPopupSmartPositioning: boolean;
    setIsPopupSmartPositioning: (val: boolean) => void;




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



    // Launch at Startup
    launchAtStartup: boolean;
    setLaunchAtStartup: (val: boolean) => void;
    enableEyeAnimation: boolean;
    setEnableEyeAnimation: (val: boolean) => void;
    // Clipboard privacy: when false, the main process stops reading the clipboard
    clipboardMonitoring: boolean;
    setClipboardMonitoring: (val: boolean) => void;
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
        content: `<p><strong>你的模块化、始终置顶的桌面实用侧边栏。</strong></p>
<p>一个多线程创意助手，常驻你的屏幕边缘。</p>
<br>
<p><strong>🌟 开源与支持</strong></p>
<p>KoBar 是一个完全开源的项目！我们欢迎你的反馈和贡献。</p>
<p>如需报告问题、获取支持、提出功能建议或进行赞助，请访问我们的 GitHub 仓库：<a href="https://github.com/eedali/KoBar" target="_blank" rel="noopener noreferrer">https://github.com/eedali/KoBar</a></p>
<br>
<p><strong>🚀 KoBar 功能</strong></p>
<ul>
    <li>⚡ <strong>应用启动器（快捷方式）：</strong> 从侧边栏一键固定并启动你常用的应用。拖拽任意文件或应用即可创建快捷方式。</li>
    <li>📋 <strong>剪贴板管理器（复制与粘贴）：</strong> 多槽位剪贴板，自动保存你的复制历史。单击即可访问并粘贴过去的剪贴内容。</li>
    <li>📅 <strong>KoCalendar（日历）：</strong> 快速查看你的日程和重要日期。无需离开当前工作流即可保持条理。</li>
    <li>✅ <strong>待办事项列表：</strong> 用简单有效的可勾选列表跟踪你的日常任务。直接在屏幕边缘高效管理你的目标。</li>
    <li>📝 <strong>代码片段库：</strong> 存储和管理你常用的代码块或文本片段。需要时一键复制到剪贴板。</li>
    <li>📸 <strong>截图工作室：</strong> 内置标注和编辑工具，即时捕获屏幕。无需打开外部软件即可保存或分享截图。</li>
    <li>🧮 <strong>计算器：</strong> 一个简洁的弹出式计算器，随时进行快速数学运算。</li>
    <li>🎨 <strong>取色器：</strong> 轻松从屏幕任意位置取色，获取 HEX 或 RGB 值。非常适合快速设计和开发。</li>
    <li>🤖 <strong>AI Hub：</strong> 集成式人工智能助手，用于快速查询和头脑风暴。直接在桌面发挥 AI 的力量。</li>
</ul>
<br>
<p><strong>⚙️ 设置与个性化</strong></p>
<p>如需将 KoBar 配置为完全符合你的需求，只需点击此笔记面板右上角的 <strong>设置图标 ⚙️</strong>。</p>
<ul>
    <li>📂 <strong>工作区：</strong> 针对特定任务（例如编码、设计、休闲）保存和加载不同的侧边栏功能布局。单击即可在不同 KoBar 配置之间切换。</li>
    <li>🎨 <strong>个性化：</strong> 让 KoBar 真正属于你！你可以自由定制主题颜色，匹配你的个人风格。</li>
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








            isPopupSmartPositioning: false,
            setIsPopupSmartPositioning: (val: boolean) => set({ isPopupSmartPositioning: val }),



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

            // Launch at Startup
            launchAtStartup: true,
            setLaunchAtStartup: (val) => {
                set({ launchAtStartup: val });
                window.api?.setAutoLaunch?.(val);
            },
            enableEyeAnimation: true,
            setEnableEyeAnimation: (val) => set({ enableEyeAnimation: val }),

            clipboardMonitoring: true,
            setClipboardMonitoring: (val) => set({ clipboardMonitoring: val }),
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

            // Tutorial State
            tutorialState: { version: '1.0.0', status: 'pending' },
            setTutorialState: (updates) => set((state) => {
                console.log('[Store] Updating tutorial state:', updates);
                return { tutorialState: { ...state.tutorialState, ...updates } };
            }),
            isManualTutorialTrigger: false,
            setIsManualTutorialTrigger: (val) => set({ isManualTutorialTrigger: val }),
            isHighlightingToggleNotes: false,
            setIsHighlightingToggleNotes: (val) => set({ isHighlightingToggleNotes: val }),
            isHighlightingSettingsBtn: false,
            setIsHighlightingSettingsBtn: (val) => set({ isHighlightingSettingsBtn: val }),

            // Eye Notification
            eyeNotification: null,
            showEyeNotification: (data) => set({ eyeNotification: { ...data, isVisible: true } }),
            hideEyeNotification: () => set((state) => ({ 
                eyeNotification: state.eyeNotification ? { ...state.eyeNotification, isVisible: false } : null 
            })),
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
                    isPopupSmartPositioning: state.isPopupSmartPositioning,
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
                    isPopupSmartPositioning: ws.isPopupSmartPositioning || false,
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


                    isPopupSmartPositioning: state.isPopupSmartPositioning,

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
                // version 20 migration for tutorial state
                if (version <= 19) {
                    if (persistedState.tutorialState === undefined) {
                        persistedState.tutorialState = { version: '1.0.0', status: 'pending' };
                    }
                }
                // version 19 migration for tutorial state
                if (version <= 18) {
                    if (persistedState.tutorialState === undefined) {
                        persistedState.tutorialState = { version: '1.0.0', status: 'pending' };
                    }
                    if (persistedState.isHighlightingToggleNotes === undefined) {
                        persistedState.isHighlightingToggleNotes = false;
                    }
                    if (persistedState.isHighlightingSettingsBtn === undefined) {
                        persistedState.isHighlightingSettingsBtn = false;
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
                tutorialState: state.tutorialState,

                theme: state.theme,
                customThemeColor: state.customThemeColor,
                showTooltips: state.showTooltips,
                sidebarWidth: state.sidebarWidth,
                iconScale: state.iconScale,
                teleportShortcut: state.teleportShortcut,
                launchAtStartup: state.launchAtStartup,
                enableEyeAnimation: state.enableEyeAnimation,
                clipboardMonitoring: state.clipboardMonitoring,
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

