import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Every caller renders model-generated markdown, so the allowlist stays narrow.
const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'h2',
    'h3',
    'h4',
    'blockquote',
    'code',
    'pre',
    'a',
    'hr',
];
const FORBID_ATTR = ['style', 'class', 'onerror', 'onclick', 'onload'];

// `dompurify` needs a real DOM; without one it exposes a stub that has no `addHook` and
// whose `sanitize()` is a pass-through. We deliberately do not paper over that with
// `isomorphic-dompurify` — that pulls jsdom into the serverless bundle, and jsdom's CJS
// internals `require()` ESM-only packages, which crashes the renderer with
// ERR_REQUIRE_ESM on Node runtimes older than 20.19 / 22.12.
if (DOMPurify.isSupported) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
            node.setAttribute('rel', 'noopener noreferrer');
            node.setAttribute('target', '_blank');
        }
    });
}

function toSafeHtml(source: string, allowedAttr: string[]): string {
    // No DOM means no sanitizer. Emitting unsanitized model output would be worse than
    // emitting nothing, so server renders stay empty and fill in on hydration.
    if (!DOMPurify.isSupported) return '';

    const rawHtml = marked.parse(source ?? '', { async: false, gfm: true, breaks: true }) as string;
    return DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS, ALLOWED_ATTR: allowedAttr, FORBID_ATTR });
}

/** Markdown -> sanitized HTML for on-screen rendering. Links are forced to open safely. */
export function renderMarkdown(source: string): string {
    return toSafeHtml(source, ['href', 'rel', 'target']);
}

/** Markdown -> sanitized HTML for the PDF export, where `rel`/`target` carry no meaning. */
export function renderMarkdownForPdf(source: string): string {
    return toSafeHtml(source, ['href']);
}
