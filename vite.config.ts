import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split heavy third-party libraries into dedicated chunks so the
          // initial bundle stays under Vite's 500 kB warning threshold and
          // unchanged libraries keep their cache across app updates.
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/zustand/') || id.includes('node_modules/scheduler/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tiptap/') || id.includes('node_modules/@codemirror/') || id.includes('node_modules/tiptap')) {
            return 'editor-vendor';
          }
          if (id.includes('node_modules/konva/') || id.includes('node_modules/react-konva/')) {
            return 'canvas-vendor';
          }
          if (id.includes('node_modules/emoji-picker-react/')) {
            return 'emoji-vendor';
          }
          if (id.includes('node_modules/react-syntax-highlighter/') || id.includes('node_modules/refractor/') || id.includes('node_modules/prismjs/') || id.includes('node_modules/highlight.js/')) {
            return 'syntax-highlight-vendor';
          }
          if (id.includes('node_modules/turndown/')) {
            return 'turndown-vendor';
          }
          if (id.includes('node_modules/marked/') || id.includes('node_modules/react-markdown/') || id.includes('node_modules/remark-') || id.includes('node_modules/micromark') || id.includes('node_modules/mdast') || id.includes('node_modules/unified') || id.includes('node_modules/hast') || id.includes('node_modules/parse-entities')) {
            return 'markdown-vendor';
          }
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
})
