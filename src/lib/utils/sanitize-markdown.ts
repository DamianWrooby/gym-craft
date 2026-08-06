import { Marked } from 'marked';
import { FilterXSS } from 'xss';

/**
 * Renders LLM-generated markdown to HTML that is safe to pass to `{@html}`.
 *
 * `marked` turns markdown into HTML, then `xss` filters that HTML down to the allowlist
 * below. The filter is the security boundary: it re-parses whatever `marked` produced,
 * so nothing upstream of it has to be trusted to emit well-formed markup.
 *
 * `xss` is used rather than DOMPurify because it has its own HTML parser and needs no
 * DOM. DOMPurify sanitizes by parsing with a real DOM, which on the server means jsdom —
 * a ~17 MB dependency tree whose ESM-only internals crashed the serverless renderer with
 * ERR_REQUIRE_ESM. This module runs identically on the server and in the browser, so
 * server rendering works and there is no falling back to empty output.
 */

// Kept deliberately narrow: everything here is markup `marked` produces from markdown,
// and the styles in Markdown.svelte only cover these tags.
const ALLOWED = {
    p: [],
    br: [],
    strong: [],
    em: [],
    ul: [],
    ol: [],
    li: [],
    h2: [],
    h3: [],
    h4: [],
    blockquote: [],
    code: [],
    pre: [],
    hr: [],
    a: ['href', 'rel', 'target'],
};

const filter = new FilterXSS({
    whiteList: ALLOWED,
    // Drop disallowed tags rather than escaping them into visible `&lt;tag&gt;` text.
    // Children are kept, so an h1 or a table degrades to its text content.
    stripIgnoreTag: true,
    // ...except for these, whose bodies are markup noise rather than prose.
    stripIgnoreTagBody: ['script', 'style'],
});

// `marked` does not add rel/target itself, and `xss` can filter attributes but not add
// them, so the anchor is built here and filtered afterwards. Interpolating an unescaped
// href is safe precisely because `filter.process()` re-parses the result — that is what
// rejects a href trying to break out of the attribute, and what drops non-http schemes.
//
// NOTE: this must stay an object literal. `marked.use()` copies renderer methods with
// `for...in`, which skips the non-enumerable methods of a `class extends Renderer`.
const marked = new Marked({
    gfm: true,
    breaks: true,
    async: false,
    renderer: {
        link({ href, tokens }) {
            const text = this.parser.parseInline(tokens);
            return `<a href="${href}" rel="noopener noreferrer" target="_blank">${text}</a>`;
        },
    },
});

/**
 * Markdown -> sanitized HTML. Links are forced to open safely. The PDF export shares this
 * output — `rel`/`target` are inert there, and the sanitizer this replaces emitted them
 * anyway via its global `afterSanitizeAttributes` hook.
 */
export function renderMarkdown(source: string): string {
    return filter.process(marked.parse(source ?? '') as string);
}
