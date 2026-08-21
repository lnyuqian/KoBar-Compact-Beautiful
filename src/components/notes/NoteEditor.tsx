import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { marked } from 'marked';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EditorView } from '@codemirror/view';
import { useAppStore } from '../../store/useAppStore';
import MarkdownEditor from './MarkdownEditor';

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
turndown.keep(['span']);

// Detect raw Markdown content (no HTML tags) that should be rendered as Markdown
const looksLikeMarkdown = (content: string): boolean => {
    if (!content) return false;
    if (/<\/?[a-z][\s\S]*>/i.test(content)) return false; // contains HTML → TipTap render
    return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```)/.test(content)
        || /\*\*[^*\n]+\*\*/.test(content)
        || /\[[^\]]+\]\([^)]+\)/.test(content);
};

// ─── Paragraph with a per-paragraph copy button (read mode only) ───
const ParagraphWithCopy = Node.create({
    name: 'paragraph',
    group: 'block',
    content: 'inline*',
    priority: 1000,
    parseHTML() {
        return [{ tag: 'p' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['p', HTMLAttributes, 0];
    },
    addNodeView() {
        return ({ node, editor }) => {
            const dom = document.createElement('p');
            dom.className = 'relative para-node group';
            const contentDom = document.createElement('span');
            contentDom.className = 'para-content';
            const btn = document.createElement('button');
            btn.className = 'para-copy-btn material-symbols-outlined no-drag-region';
            btn.textContent = 'content_copy';
            btn.title = '复制段落';
            btn.addEventListener('mousedown', (e) => e.preventDefault());
            btn.addEventListener('click', () => {
                const text = node.textContent || '';
                const copyViaTextarea = () => {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    } catch (err) {
                        console.error('复制失败:', err);
                        window.api?.sendNotification?.('复制失败', '无法复制段落文本。');
                    }
                };
                if (window.api?.writeToClipboard) {
                    window.api.writeToClipboard({ type: 'text', content: text });
                } else if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(text).catch(copyViaTextarea);
                } else {
                    copyViaTextarea();
                }
                btn.style.color = '#FFD54F';
                setTimeout(() => { btn.style.color = ''; }, 1500);
            });
            dom.appendChild(contentDom);
            dom.appendChild(btn);
            void editor;
            return { dom, contentDOM: contentDom };
        };
    },
});

// Preset palette for the text color picker
const COLOR_PRESETS = ['#a3a3a3', '#737373', '#f43f5e', '#f59e0b', '#facc15', '#4ade80', '#22d3ee', '#3b82f6', '#a78bfa', '#f472b6'];

const NoteEditor: React.FC = React.memo(() => {
    const { activeNoteId, updateNoteTitle, t, design } = useAppStore();
    const activeNote = useAppStore((state) => state.notes.find(n => n.id === activeNoteId));
    const editorFontSize = useAppStore((state) => state.editorFontSize);
    const editorLineHeight = useAppStore((state) => state.editorLineHeight);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isUpdatingFromStore = useRef(false);
    const cmViewRef = useRef<EditorView | null>(null);
    const isEditing = useAppStore((state) => state.isEditing);
    const setIsEditing = useAppStore((state) => state.setIsEditing);
    const [, setTick] = useState(0);

    // Markdown ↔ HTML conversion helpers
    const htmlToMd = useCallback((html: string) => {
        // turndown produces two cosmetic artifacts for lists that we normalize:
        //  1. "<li><p>…</p></li>" yields a blank (whitespace-only) line between
        //     list items, which makes the list look double-spaced. Remove it.
        //  2. Markers are padded with alignment spaces ("-   item") instead of
        //     the conventional single space ("- item").
        return turndown
            .turndown(html || '')
            .replace(/(\n)[ \t]*\n/g, '\n')
            .replace(/^([ \t]*)([-*+]) {2,}/gm, '$1$2 ');
    }, []);

    const mdToHtml = useCallback((md: string) => {
        return marked.parse(md || '') as string;
    }, []);

    // Initial Markdown value when entering edit mode (convert once from the stored HTML)
    const initialMd = useMemo(() => htmlToMd(activeNote?.content || ''), [activeNote?.content, htmlToMd]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true },
                orderedList: { keepMarks: true },
                paragraph: false,
            }),
            ParagraphWithCopy,
            Underline,
            TextStyle,
            Color,
            Image.configure({
                inline: false,
                allowBase64: true,
            }),
            Placeholder.configure({
                placeholder: 'Start writing your note…',
            }),
        ],
        content: activeNote?.content || '',
        editorProps: {
            attributes: {
                class: 'flex-1 text-slate-300 text-sm leading-[1.4] outline-none no-drag-region overflow-y-auto max-w-none',
                spellcheck: 'false',
            },
        },
        onUpdate: ({ editor: ed }) => {
            if (isUpdatingFromStore.current) return;
            const currentTabId = useAppStore.getState().activeNoteId;
            if (currentTabId) {
                useAppStore.getState().updateNoteContent(currentTabId, ed.getHTML());
            }
        },
        onSelectionUpdate: () => {
            setTick((prev) => prev + 1);
        },
        onTransaction: () => {
            setTick((prev) => prev + 1);
        },
    }, []);

    // Sync TipTap content when active tab changes OR when toggling back from
    // edit mode (so MD edits incl. colors are reflected in read mode)
    useEffect(() => {
        if (!editor || !activeNoteId) return;
        const note = useAppStore.getState().notes.find(n => n.id === activeNoteId);
        if (note) {
            isUpdatingFromStore.current = true;
            editor.commands.setContent(note.content || '');
            isUpdatingFromStore.current = false;
        }
    }, [activeNoteId, isEditing, editor]);

    // Restore scroll position on mount/tab switch (Non-Reactive)
    useEffect(() => {
        if (!editor || !activeNoteId) return;
        const scrollNode = editor.view.dom.parentElement;
        if (!scrollNode) return;
        const savedPos = useAppStore.getState().scrollPositions[`note_${activeNoteId}`];
        if (savedPos !== undefined) {
            setTimeout(() => { scrollNode.scrollTop = savedPos; }, 50);
        }
    }, [editor, activeNoteId]);

    useEffect(() => {
        if (!editor || !activeNoteId) return;
        const scrollNode = editor.view.dom.parentElement;
        if (!scrollNode) return;
        const handleScroll = () => {
            useAppStore.getState().setScrollPosition(`note_${activeNoteId}`, scrollNode.scrollTop);
        };
        scrollNode.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollNode.removeEventListener('scroll', handleScroll);
    }, [editor, activeNoteId]);

    // Apply typography settings (font size & line height) to TipTap DOM (read mode)
    useEffect(() => {
        if (!editor) return;
        editor.view.dom.style.fontSize = `${editorFontSize}px`;
        editor.view.dom.style.lineHeight = String(editorLineHeight);
    }, [editor, editorFontSize, editorLineHeight]);

    // Edit / Read mode: TipTap editable only in read-mode rendering is disabled;
    // edit mode uses the CodeMirror Markdown editor instead
    useEffect(() => {
        if (!editor) return;
        editor.setEditable(false);
    }, [editor]);

    const enterEditMode = useCallback(() => {
        // Flush latest HTML → MD once
        const note = useAppStore.getState().notes.find(n => n.id === activeNoteId);
        setIsEditing(true);
        void note;
    }, [activeNoteId, setIsEditing]);

    const exitEditMode = useCallback(() => {
        // Flush latest MD → HTML into the store
        const note = useAppStore.getState().notes.find(n => n.id === activeNoteId);
        if (note && cmViewRef.current) {
            useAppStore.getState().updateNoteContent(note.id, mdToHtml(cmViewRef.current.state.doc.toString()));
        }
        setIsEditing(false);
    }, [activeNoteId, mdToHtml, setIsEditing]);

    // Markdown changes → debounced save as HTML
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleMdChange = useCallback((md: string) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            const note = useAppStore.getState().notes.find(n => n.id === activeNoteId);
            if (note) {
                useAppStore.getState().updateNoteContent(note.id, mdToHtml(md));
            }
        }, 600);
    }, [activeNoteId, mdToHtml]);

    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    // Handle local image file selection (insert as base64 markdown image in edit mode)
    const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            if (isEditing && cmViewRef.current) {
                const view = cmViewRef.current;
                view.dispatch(view.state.replaceSelection(`\n![image](${base64})\n`));
            } else if (editor) {
                editor.chain().focus().setImage({ src: base64 }).run();
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }, [isEditing, editor]);


    const triggerImagePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // Apply color to the current selection (edit mode → wraps in <span style>; read mode → TipTap)
    const applyColor = useCallback((color: string) => {
        if (isEditing && cmViewRef.current) {
            const view = cmViewRef.current;
            const { from, to, empty } = view.state.selection.main;
            if (empty) {
                view.dispatch(view.state.replaceSelection(`<span style="color:${color}"> </span>`));
                return;
            }
            const selText = view.state.sliceDoc(from, to);
            view.dispatch(view.state.replaceSelection(`<span style="color:${color}">${selText}</span>`));
        } else if (editor) {
            editor.chain().focus().setColor(color).run();
        }
    }, [isEditing, editor]);

    if (!activeNote) return null;

    // Keep the content column aligned: fixed 2% symmetric insets (content centered)
    const panelPaddingLeft = 2;
    const panelPaddingRight = 2;

    return (
        <div
            className={`relative flex-1 pt-2.5 flex flex-col overflow-x-hidden w-full max-w-full ${design === 'style2' ? 'bg-transparent' : ''}`}
        >
            {/* Hidden file input for image selection */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileSelect}
            />

            {/* Title: edit mode only (read mode shows body only; title lives on the tab) */}
            {isEditing && (
                <div className="flex items-center gap-4 mb-2 no-drag-region" style={{ paddingLeft: `${panelPaddingLeft}%`, paddingRight: `${panelPaddingRight}%` }}>
                    <input
                        className="bg-transparent font-normal text-slate-100 border-none outline-none w-full focus:ring-0 placeholder-slate-700"
                        style={{ fontSize: editorFontSize + 6 }}
                        placeholder={t('noteTitlePlaceholder')}
                        type="text"
                        value={activeNote.title}
                        onChange={(e) => updateNoteTitle(activeNote.id, e.target.value)}
                    />
                </div>
            )}

            {/* Formatting Toolbar (Edit Mode Only) */}
            {isEditing && (
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b text-[#a3a3a3] no-drag-region flex-wrap" style={{ borderColor: 'var(--theme-border)', paddingLeft: `${panelPaddingLeft}%`, paddingRight: `${panelPaddingRight}%` }}>
                    {/* Image insert */}
                    <button
                        onClick={triggerImagePicker}
                        className="hover:text-slate-200 transition-colors cursor-pointer mt-[2px]"
                        title="插入图片"
                    >
                        <span className="material-symbols-outlined text-[18px] text-[#a3a3a3]">image</span>
                    </button>

                    <div className="w-px h-5" style={{ backgroundColor: 'var(--theme-border)' }}></div>

                    {/* Text color */}
                    <div className="flex items-center gap-1">
                        {COLOR_PRESETS.map((c) => (
                            <button
                                key={c}
                                onClick={() => applyColor(c)}
                                className="w-4 h-4 rounded-full transition-transform hover:scale-125 cursor-pointer"
                                style={{ backgroundColor: c, border: '1px solid rgba(255,255,255,0.2)' }}
                                title={`文字颜色 ${c}`}
                            />
                        ))}
                    </div>

                </div>
            )}

            {/* Editor Content: edit mode = CodeMirror Markdown, read mode = auto render.
                Double-click toggles: read → edit, edit → read */}
            {isEditing ? (
                <div
                    className="flex-1 min-h-0 flex flex-col no-drag-region relative"
                    onDoubleClick={exitEditMode}
                >
                    <MarkdownEditor
                        key={`md-${activeNote.id}`}
                        value={initialMd}
                        fontSize={editorFontSize}
                        lineHeight={editorLineHeight}
                        paddingLeftPercent={panelPaddingLeft}
                        paddingRightPercent={panelPaddingRight}
                        onChange={handleMdChange}
                        onReady={(view) => { cmViewRef.current = view; }}
                        doneButton={{ onClick: exitEditMode }}
                    />
                </div>
            ) : looksLikeMarkdown(activeNote.content) ? (
                <div
                    className="md-render flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-drag-region custom-scrollbar"
                    style={{ fontSize: `${editorFontSize}px`, lineHeight: String(editorLineHeight), paddingLeft: `${panelPaddingLeft}%`, paddingRight: `${panelPaddingRight}%`, marginBottom: 0 }}
                    onDoubleClick={enterEditMode}
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeNote.content}</ReactMarkdown>
                </div>
            ) : (
                <EditorContent editor={editor} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-drag-region" style={{ paddingLeft: `${panelPaddingLeft}%`, paddingRight: `${panelPaddingRight}%`, marginBottom: 0 }} onDoubleClick={enterEditMode} />
            )}

        </div>
    );
});

export default NoteEditor;
