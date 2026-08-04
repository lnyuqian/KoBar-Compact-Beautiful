import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import NoteEditor from './NoteEditor';
import SettingsPanel from './SettingsPanel';
import PluginsPanel from '../plugins/PluginsPanel';
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
    const isHighlightingPluginsBtn = useAppStore(state => state.isHighlightingPluginsBtn);
    const openSettingsTab = useAppStore(state => state.openSettingsTab);
    const openPluginsTab = useAppStore(state => state.openPluginsTab);
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

    // Close on outside click for delete confirm
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target as Node)) {
                setDeleteConfirm(null);
            }
        };
        if (deleteConfirm !== null) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [deleteConfirm]);

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        const noteToDelete = notes.find(n => n.id === id);
        if (noteToDelete?.isSettings || noteToDelete?.isPlugins) {
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
            className={`relative flex flex-col rounded-[12px] z-30 shadow-2xl shrink-0 pointer-events-auto ${isNotePanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}
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
                className="flex flex-col pt-2 px-2 pb-2 gap-1.5 no-drag-region shrink-0 relative transition-all duration-500"
                style={{ backgroundColor: '#424242' }}
            >
                {/* Tab grid: 2 per row, 90% width, 10% right gap */}
                <div
                    ref={tabsRef}
                    onMouseDown={handleTabsMouseDown}
                    onMouseLeave={handleTabsMouseLeave}
                    onMouseUp={handleTabsMouseUp}
                    onMouseMove={handleTabsMouseMove}
                    className={`grid grid-cols-2 gap-1 w-[90%] max-h-[240px] overflow-y-auto scrollbar-hide select-none ${isDraggingTabs ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    {notes.map((note) => (
                        <div
                            key={note.id}
                            role="button"
                            onClick={() => handleTabClick(note.id)}
                            className={`group w-full pl-2 pr-1 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap overflow-hidden shrink-0 snap-start no-drag-region bg-[#535353] ${note.id === activeNoteId
                                ? 'text-slate-200 border-l-2 border-[var(--theme-primary)]'
                                : 'text-white hover:text-white hover:bg-white/5 cursor-pointer border-l-2 border-transparent'
                                }`}
                        >
                            {note.isSettings ? t('settings') : note.title}
                            <div className={`${note.id === activeNoteId ? 'flex' : 'hidden group-hover:flex'} items-center ml-auto`}>
                                <span
                                    onClick={(e) => handleDelete(e, note.id)}
                                    className="material-symbols-outlined text-[9px] text-[#989898] hover:text-slate-200 hover:bg-slate-800 rounded-sm transition-all p-0.5"
                                    title={t('closeTab')}
                                >
                                    close
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Action Row: + (left), Plugins, Settings (right), right-aligned */}
                <div className="flex items-center justify-end gap-0.5 pointer-events-auto">
                    <button
                        onClick={() => addNote()}
                        className="p-0.5 transition-all flex items-center justify-center text-[#989898] hover:text-primary rounded-lg hover:bg-white/5 cursor-pointer"
                        title={t('addNewNote')}
                    >
                        <span className="material-symbols-outlined text-[12px]">add</span>
                    </button>
                    <button
                        onClick={openPluginsTab}
                        className={`p-0.5 transition-all flex items-center justify-center ${isHighlightingPluginsBtn ? 'ring-4 ring-primary animate-pulse text-primary bg-primary/20 rounded-full' : 'text-[#989898] hover:text-primary rounded-lg hover:bg-white/5'}`}
                        title={(t as any)('plugins') || 'Plugins'}
                    >
                        <span className="material-symbols-outlined text-[12px]">extension</span>
                    </button>
                    <button
                        onClick={openSettingsTab}
                        className={`p-0.5 transition-all flex items-center justify-center ${isHighlightingSettingsBtn ? 'ring-4 ring-primary animate-pulse text-primary bg-primary/20 rounded-full' : 'text-[#989898] hover:text-primary rounded-lg hover:bg-white/5'}`}
                        title={t('settings')}
                    >
                        <span className="material-symbols-outlined text-[12px]">settings</span>
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
            </div>

            {/* Editor or Settings Area */}
            <div
                className="flex-1 flex flex-col overflow-hidden"
                style={{ backgroundColor: '#535353' }}
            >
                {activeNote?.isSettings ? (
                    <SettingsPanel />
                ) : activeNote?.isPlugins ? (
                    <PluginsPanel />
                ) : (
                    <NoteEditor />
                )}
            </div>
        </div>
    );
};

export default NotePanel;
