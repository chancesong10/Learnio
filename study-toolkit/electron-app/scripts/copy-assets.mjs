// Copies non-TypeScript files into dist/. Third-party browser libraries are bundled
// locally because the page's Content-Security-Policy only allows scripts from the app.
import { cpSync, mkdirSync } from 'fs';

const copies = [
    ['src/renderer.html', 'dist/renderer.html'],
    ['src/preload.cjs', 'dist/preload.cjs'],
    ['node_modules/marked/lib/marked.umd.js', 'dist/vendor/marked.umd.js'],
    ['node_modules/dompurify/dist/purify.min.js', 'dist/vendor/purify.min.js'],
    ['node_modules/katex/dist/katex.min.js', 'dist/vendor/katex/katex.min.js'],
    ['node_modules/katex/dist/katex.min.css', 'dist/vendor/katex/katex.min.css'],
    ['node_modules/katex/dist/fonts', 'dist/vendor/katex/fonts'],
];

mkdirSync('dist/vendor/katex', { recursive: true });
for (const [from, to] of copies) {
    cpSync(from, to, { recursive: true });
}
