// Renders question/answer text as Markdown with LaTeX math (KaTeX).
// The libraries are loaded as globals by renderer.html from dist/vendor.

declare const marked: { parse(src: string, options?: object): string } | undefined;
declare const DOMPurify: { sanitize(html: string, config?: object): string } | undefined;
declare const katex: { renderToString(tex: string, options?: object): string } | undefined;

// Order matters: display delimiters before inline ones
const MATH_PATTERNS: Array<[RegExp, boolean]> = [
    [/\$\$([\s\S]+?)\$\$/g, true],
    [/\\\[([\s\S]+?)\\\]/g, true],
    [/\\\(([\s\S]+?)\\\)/g, false],
    // $...$ with no space just inside the delimiters, so "$5 and $10" stays plain text
    [/(?<![\\$\w])\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?![\w$])/g, false],
];

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function renderRichText(text: string): string {
    if (!text) return '';
    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined' || typeof katex === 'undefined') {
        return `<p>${escapeHtml(text)}</p>`;
    }

    // Pull math out first so Markdown can't mangle backslashes, underscores or asterisks in it
    const math: string[] = [];
    let source = text;
    for (const [pattern, displayMode] of MATH_PATTERNS) {
        source = source.replace(pattern, (_match, tex: string) => {
            math.push(katex!.renderToString(tex.trim(), { displayMode, throwOnError: false }));
            return `MATHTOKEN${math.length - 1}END`;
        });
    }

    // The text comes from Gemini and scraped PDFs, so sanitize the Markdown output.
    // KaTeX output is added afterwards: it escapes its input and is trusted.
    const html = DOMPurify.sanitize(marked.parse(source, { gfm: true, breaks: true, async: false }));
    return html.replace(/MATHTOKEN(\d+)END/g, (_match, i: string) => math[Number(i)] ?? '');
}
