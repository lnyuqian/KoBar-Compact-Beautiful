import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import NoteEditor from './NoteEditor';
import SettingsPanel from './SettingsPanel';
import ResizerHandle from './ResizerHandle';

const NotePanel: React.FC = () => {
    const isNotePanelOpen = useAppStore(state => state.isNotePanelOpen);
    const notePanelWidth = useAppStore(state => state.notePanelWidth);
    const notePanelHeight = useAppStore(state => state.notePanelHeight);
    const notes = useAppStore(state => state.notes);
    const activeNoteId = useAppStore(state => state.activeNoteId);
    const setActiveNoteId = useAppStore(state => state.setActiveNoteId);
    const addNote = useAppStore(state => state.addNote);
    const deleteNote = useAppStore(state => state.deleteNote);
    const t = useAppStore(state => state.t);
    const isHighlightingSettingsBtn = useAppStore(state => state.isHighlightingSettingsBtn);
    const openSettingsTab = useAppStore(state => state.openSettingsTab);
    const favorites = useAppStore(state => state.favorites);
    const toggleFavorite = useAppStore(state => state.toggleFavorite);
    const deleteFavorite = useAppStore(state => state.deleteFavorite);
    const openFavorite = useAppStore(state => state.openFavorite);
    const design = useAppStore(state => state.design);
    const glassOpacity = useAppStore(state => state.glassOpacity);
    const isMac = useAppStore(state => state.isMac);

    const activeNote = notes.find(n => n.id === activeNoteId);

    // Direct DOM access for zero-latency resizing
    const panelRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Sync panel dimensions when store changes externally (double-click reset, tab switch, etc.)
    useEffect(() => {
        if (panelRef.current && !isResizing) {
            panelRef.current.style.width = `${notePanelWidth}px`;
            panelRef.current.style.height = `${notePanelHeight}px`;
        }
    }, [notePanelWidth, notePanelHeight, isResizing]);



    // Callback for resizer handles to update DOM directly
    const handleResizeTemp = useCallback((w: number, h: number) => {
        if (panelRef.current) {
            panelRef.current.style.width = `${w}px`;
            panelRef.current.style.height = `${h}px`;
        }
        if (!isResizing) setIsResizing(true);
    }, [isResizing]);

    const [deleteConfirm, setDeleteConfirm] = useState<{ id: number, x: number, y: number } | null>(null);
    const deleteConfirmRef = useRef<HTMLDivElement>(null);

    const [favDeleteConfirm, setFavDeleteConfirm] = useState<{ id: number, x: number, y: number } | null>(null);
    const favDeleteConfirmRef = useRef<HTMLDivElement>(null);

    // Favorites dropdown state
    const [isFavOpen, setIsFavOpen] = useState(false);
    const favBtnRef = useRef<HTMLButtonElement>(null);
    const favMenuRef = useRef<HTMLDivElement>(null);
    const [favMenuPos, setFavMenuPos] = useState<{ x: number, y: number } | null>(null);

    // Favorites whose document is NOT currently open as a tab
    const openableFavorites = favorites.filter(f => !notes.some(n => n.id === f.id));

    const isFavorite = useCallback((noteId: number) => favorites.some(f => f.id === noteId), [favorites]);

    // Close popups on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(target)) {
                setDeleteConfirm(null);
            }
            if (favDeleteConfirmRef.current && !favDeleteConfirmRef.current.contains(target)) {
                setFavDeleteConfirm(null);
            }
            if (favMenuRef.current && !favMenuRef.current.contains(target)
                && favBtnRef.current && !favBtnRef.current.contains(target)) {
                setIsFavOpen(false);
            }
        };
        if (deleteConfirm !== null || favDeleteConfirm !== null || isFavOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [deleteConfirm, favDeleteConfirm, isFavOpen]);

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const noteToDelete = notes.find(n => n.id === id);
        if (noteToDelete?.isSettings) {
            deleteNote(id);
            return;
        }
        setDeleteConfirm({ id, x: e.clientX, y: e.clientY });
    };

    const confirmDelete = () => {
        if (deleteConfirm) {
            deleteNote(deleteConfirm.id);
            setDeleteConfirm(null);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirm(null);
    };

    const toggleFavMenu = () => {
        if (isFavOpen) {
            setIsFavOpen(false);
            return;
        }
        if (favBtnRef.current) {
            const r = favBtnRef.current.getBoundingClientRect();
            setFavMenuPos({ x: r.right, y: r.bottom + 6 });
        }
        setIsFavOpen(true);
    };

    const tabsRef = useRef<HTMLDivElement>(null);
    const [isDraggingTabs, setIsDraggingTabs] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeftState, setScrollLeftState] = useState(0);
    const [dragDistance, setDragDistance] = useState(0);

    const handleTabsMouseDown = (e: React.MouseEvent) => {
        if (!tabsRef.current) return;
        setIsDraggingTabs(true);
        setStartX(e.pageY - tabsRef.current.offsetTop);
        setScrollLeftState(tabsRef.current.scrollTop);
        setDragDistance(0);
    };

    const handleTabsMouseLeave = () => {
        setIsDraggingTabs(false);
    };

    const handleTabsMouseUp = () => {
        setIsDraggingTabs(false);
    };

    const handleTabsMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingTabs || !tabsRef.current) return;
        e.preventDefault();
        const y = e.pageY - tabsRef.current.offsetTop;
        const walk = (y - startX) * 1.5; // Scroll speed multiplier
        tabsRef.current.scrollTop = scrollLeftState - walk;
        setDragDistance(Math.abs(walk));
    };

    const handleTabClick = (noteId: number) => {
        // Only switch tabs if we didn't drag much
        if (dragDistance < 5) {
            setActiveNoteId(noteId);
        }
    };

    return (
        <div
            ref={panelRef}
            className={`relative flex flex-col rounded-[12px] overflow-hidden z-30 shadow-2xl shrink-0 pointer-events-auto ${isNotePanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}
                ${isResizing ? '' : 'transition-all duration-500'}`}
            style={{
                width: `${notePanelWidth}px`,
                height: `${notePanelHeight}px`,
                backgroundColor: design === 'style2'
                    ? `color-mix(in srgb, var(--theme-bg-base) ${glassOpacity}%, transparent)`
                    : 'var(--theme-bg-base)',
                borderColor: 'transparent',
                backdropFilter: design === 'style2' ? (isMac ? 'blur(8px)' : 'blur(32px)') : 'none',
                willChange: 'width, height'
            }}
        >
            {/* Side Resizer */}
            <ResizerHandle direction="side" onResizeTemp={handleResizeTemp} onResizeEnd={() => setIsResizing(false)} />
            {/* Bottom Resizer */}
            <ResizerHandle direction="bottom" onResizeTemp={handleResizeTemp} onResizeEnd={() => setIsResizing(false)} />
            {/* Corner Resizer */}
            <ResizerHandle direction="corner" onResizeTemp={handleResizeTemp} onResizeEnd={() => setIsResizing(false)} />

            {/* Tabs Header */}
            <div
                className="flex flex-col pt-2 px-2 pb-2 gap-1.5 no-drag-region shrink-0 relative"
                style={{ backgroundColor: '#424242' }}
            >
                {/* Tab grid: 2 per row, 93% width, 7% right gap */}
                <div
                    ref={tabsRef}
                    onMouseDown={handleTabsMouseDown}
                    onMouseLeave={handleTabsMouseLeave}
                    onMouseUp={handleTabsMouseUp}
                    onMouseMove={handleTabsMouseMove}
                    className={`grid grid-cols-2 gap-1 w-[93%] max-h-[240px] overflow-y-auto scrollbar-hide select-none ${isDraggingTabs ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            role="button"
                            onClick={() => handleTabClick(note.id)}
                            className={`group w-full pl-2 pr-1 py-0.5 text-xs font-medium rounded-md flex items-center gap-1.5 whitespace-nowrap overflow-hidden shrink-0 snap-start no-drag-region bg-[#535353] ${note.id === activeNoteId
                                ? 'text-slate-200 border-l-2 border-[var(--theme-primary)]'
                                : 'text-white cursor-pointer border-l-2 border-transparent'
                                }`}
                        >
                            {/* Favorite star (left side of each tab) */}
                            {!note.isSettings && (
                                <span
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(note.id); }}
                                    className={`${isFavorite(note.id) ? 'material-symbols-rounded' : 'material-symbols-rounded-fill0'} text-[6.3px] cursor-pointer shrink-0 ${isFavorite(note.id) ? 'text-[#FFD54F]' : 'text-[#989898] hover:text-slate-200'}`}
                                    title={isFavorite(note.id) ? t('unfavorite') : t('favorite')}
                                >
                                    {isFavorite(note.id) ? 'star' : 'star_border'}
                                </span>
                            )}
                            <span className="truncate min-w-0 flex-1">{note.isSettings ? t('settings') : note.title}</span>
                            {/* Close: hidden until the tab is hovered, 0.7x smaller */}
                            <span
                                onClick={(e) => handleDelete(e, note.id)}
                                className="material-symbols-rounded text-[5px] text-[#989898] opacity-0 group-hover:opacity-100 hover:text-slate-200 hover:bg-slate-800 rounded-sm p-0.5 transition-opacity cursor-pointer shrink-0"
                                title={t('closeTab')}
                            >
                                close
                            </span>
                        </div>
                    ))}
                </div>

                {/* Bottom Action Row: + , Favorites (star), Settings — right-aligned */}
                <div className="flex items-center justify-end gap-0.5 w-[93%] pointer-events-auto">
                    <button
                        onClick={() => addNote()}
                        className="p-0.5 transition-all flex items-center justify-center text-[#989898] hover:text-primary rounded-lg hover:bg-white/5 cursor-pointer"
                        title={t('addNewNote')}
                    >
                        <span className="material-symbols-rounded text-[12px]">add</span>
                    </button>
                    <button
                        ref={favBtnRef}
                        onClick={toggleFavMenu}
                        className={`p-0.5 transition-all flex items-center justify-center rounded-lg hover:bg-white/5 cursor-pointer ${isFavOpen ? 'text-[#FFD54F]' : 'text-[#989898] hover:text-primary'}`}
                        title={t('favorites')}
                    >
                        <span className="material-symbols-rounded text-[12px]">star</span>
                    </button>
                    <button
                        onClick={openSettingsTab}
                        className={`p-0.5 transition-all flex items-center justify-center ${isHighlightingSettingsBtn ? 'ring-4 ring-primary animate-pulse text-primary bg-primary/20 rounded-full' : 'text-[#989898] hover:text-primary rounded-lg hover:bg-white/5'}`}
                        title={t('settings')}
                    >
                        <span className="material-symbols-rounded text-[12px]">settings</span>
                    </button>
                </div>

                {/* Delete Confirm Popup */}
                {deleteConfirm !== null && createPortal(
                    <div
                        ref={deleteConfirmRef}
                        className="fixed z-[110] border rounded-lg shadow-2xl flex flex-col p-4 pointer-events-auto"
                        style={{
                            top: `${deleteConfirm.y + 10}px`,
                            left: `${deleteConfirm.x - 60}px`,
                            backgroundColor: design === 'style2'
                                ? `color-mix(in srgb, var(--theme-bg-dark) 80%, transparent)`
                                : 'var(--theme-bg-dark)',
                            borderColor: design === 'style2' ? 'rgba(255,255,255,0.1)' : 'var(--theme-border)',
                            backdropFilter: design === 'style2' ? (isMac ? 'blur(8px)' : 'blur(16px)') : 'none',
                        }}
                    >
                        <span className="text-slate-200 text-sm mb-4">{t('deleteConfirmMsg')}</span>
                        <div className="flex gap-2 justify-end items-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); cancelDelete(); }}
                                className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors rounded-md"
                                style={{ backgroundColor: design === 'style2' ? 'rgba(255,255,255,0.05)' : 'var(--theme-bg-base)' }}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); confirmDelete(); }}
                                className="px-4 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 transition-colors border border-red-500/30 rounded-md"
                            >
                                {t('deleteTitle')}
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Favorites Dropdown: lists favorited documents NOT currently open as tabs */}
                {isFavOpen && favMenuPos !== null && createPortal(
                    <div
                        ref={favMenuRef}
                        className="fixed z-[110] border rounded-lg shadow-2xl overflow-hidden pointer-events-auto animate-pop-in"
                        style={{
                            top: `${favMenuPos.y}px`,
                            left: `${favMenuPos.x - 208}px`,
                            width: 208,
                            backgroundColor: design === 'style2'
                                ? `color-mix(in srgb, var(--theme-bg-dark) 90%, transparent)`
                                : 'var(--theme-bg-dark)',
                            borderColor: design === 'style2' ? 'rgba(255,255,255,0.1)' : 'var(--theme-border)',
                            backdropFilter: design === 'style2' ? (isMac ? 'blur(8px)' : 'blur(16px)') : 'none',
                        }}
                    >
                        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b"
                            style={{ borderColor: design === 'style2' ? 'rgba(255,255,255,0.08)' : 'var(--theme-border)' }}>
                            {t('favorites')}
                        </div>
                        {openableFavorites.length === 0 ? (
                            <div className="px-3 py-4 text-xs text-slate-500 text-center">{t('favoritesEmpty')}</div>
                        ) : (
                            openableFavorites.map(f => (
                                <div
                                    key={f.id}
                                    onClick={() => { openFavorite(f.id); setIsFavOpen(false); }}
                                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 group/fav"
                                    title={f.title}
                                >
                                    <span className="material-symbols-rounded text-[10px] text-[#FFD54F] shrink-0">star</span>
                                    <span className="truncate min-w-0 flex-1 text-xs text-slate-300">{f.title || t('addNewNote')}</span>
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setFavDeleteConfirm({ id: f.id, x: e.clientX, y: e.clientY }); }}
                                        className="material-symbols-rounded text-[10px] text-[#989898] opacity-0 group-hover/fav:opacity-100 hover:text-red-400 rounded-sm p-0.5 transition-opacity cursor-pointer shrink-0"
                                        title={t('deleteTitle')}
                                    >
                                        close
                                    </span>
                                </div>
                            ))
                        )}
                    </div>,
                    document.body
                )}

                {/* Favorite Delete Confirm Popup */}
                {favDeleteConfirm !== null && createPortal(
                    <div
                        ref={favDeleteConfirmRef}
                        className="fixed z-[110] border rounded-lg shadow-2xl flex flex-col p-4 pointer-events-auto"
                        style={{
                            top: `${favDeleteConfirm.y + 10}px`,
                            left: `${favDeleteConfirm.x - 60}px`,
                            backgroundColor: design === 'style2'
                                ? `color-mix(in srgb, var(--theme-bg-dark) 80%, transparent)`
                                : 'var(--theme-bg-dark)',
                            borderColor: design === 'style2' ? 'rgba(255,255,255,0.1)' : 'var(--theme-border)',
                            backdropFilter: design === 'style2' ? (isMac ? 'blur(8px)' : 'blur(16px)') : 'none',
                        }}
                    >
                        <span className="text-slate-200 text-sm mb-4">{t('deleteFavoriteConfirmMsg')}</span>
                        <div className="flex gap-2 justify-end items-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); setFavDeleteConfirm(null); }}
                                className="px-4 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors rounded-md"
                                style={{ backgroundColor: design === 'style2' ? 'rgba(255,255,255,0.05)' : 'var(--theme-bg-base)' }}
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); deleteFavorite(favDeleteConfirm.id); setFavDeleteConfirm(null); }}
                                className="px-4 py-1.5 text-xs font-medium text-red-500 hover:text-white bg-red-500/10 hover:bg-red-500 transition-colors border border-red-500/30 rounded-md"
                            >
                                {t('deleteTitle')}
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* Editor or Settings Area */}
            <div
                className="flex-1 flex flex-col overflow-hidden"
                style={{ backgroundColor: '#535353' }}
            >
                {activeNote?.isSettings ? (
                    <SettingsPanel />
                ) : (
                    <NoteEditor />
                )}
            </div>
        </div>
    );
};

export default NotePanel;
