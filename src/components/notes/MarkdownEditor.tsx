import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
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
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ value, fontSize, lineHeight, paddingLeftPercent = 0, paddingRightPercent = 0, onChange, onReady }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const valueRef = useRef(value);
    valueRef.current = value;

    useEffect(() => {
        if (!containerRef.current) return;
        const state = EditorState.create({
            doc: valueRef.current,
            extensions: [
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
            ],
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
