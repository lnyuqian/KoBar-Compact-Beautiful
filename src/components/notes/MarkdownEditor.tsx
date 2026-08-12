import React, { useEffect, useRef } from 'react';
import { EditorState, StateField } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder, Decoration, WidgetType } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';

interface MarkdownEditorProps {
    value: string;
    fontSize: number;
    lineHeight: number;
    paddingLeftPercent?: number;
    paddingRightPercent?: number;
    onChange: (md: string) => void;
    onReady?: (view: EditorView) => void;
    doneButton?: { onClick: () => void };
}

// A widget that renders a confirm button right after the last line of content,
// so it follows the document flow instead of being pinned to the panel corner.
class DoneButtonWidget extends WidgetType {
    private onClick: () => void;
    constructor(onClick: () => void) {
        super();
        this.onClick = onClick;
    }
    override eq(other: DoneButtonWidget) {
        return other.onClick === this.onClick;
    }
    override toDOM() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flex items-center justify-center w-8 h-8 rounded-full text-slate-300 hover:text-primary hover:bg-white/10 transition-all cursor-pointer no-drag-region';
        btn.title = '完成编辑';
        const span = document.createElement('span');
        span.className = 'material-symbols-outlined text-[18px]';
        span.textContent = 'check';
        btn.appendChild(span);
        btn.addEventListener('mousedown', (e) => e.preventDefault());
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.onClick();
        });
        return btn;
    }
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, fontSize, lineHeight, paddingLeftPercent = 0, paddingRightPercent = 0, onChange, onReady, doneButton }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const valueRef = useRef(value);
    valueRef.current = value;
    const doneButtonRef = useRef(doneButton);
    doneButtonRef.current = doneButton;

    useEffect(() => {
        if (!containerRef.current) return;
        const extensions: any[] = [
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            markdown({ base: markdownLanguage }),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            oneDark,
            cmPlaceholder('Write in Markdown…'),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    onChangeRef.current(update.state.doc.toString());
                }
            }),
        ];

        if (doneButtonRef.current) {
            const doneField = StateField.define({
                create: (state) => Decoration.set([
                    Decoration.widget({
                        widget: new DoneButtonWidget(() => doneButtonRef.current?.onClick()),
                        side: 1,
                        block: true,
                    }).range(state.doc.length),
                ]),
                update: (deco, tr) => deco.map(tr.changes),
                provide: (f) => EditorView.decorations.from(f),
            });
            extensions.push(doneField);
        }

        const state = EditorState.create({
            doc: valueRef.current,
            extensions,
        });
        const view = new EditorView({ state, parent: containerRef.current });
        viewRef.current = view;
        onReady?.(view);
        return () => {
            view.destroy();
            viewRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (viewRef.current) {
            viewRef.current.dom.style.fontSize = `${fontSize}px`;
            viewRef.current.dom.style.lineHeight = String(lineHeight);
        }
    }, [fontSize, lineHeight]);

    return <div ref={containerRef} className="w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar no-drag-region" style={{ paddingLeft: `${paddingLeftPercent}%`, paddingRight: `${paddingRightPercent}%` }} />;
};

export default MarkdownEditor;
