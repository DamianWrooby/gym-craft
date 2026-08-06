// @vitest-environment node
//
// Runs without a DOM on purpose: this is the server-render path. The renderer must
// produce real sanitized HTML here rather than degrading to empty output, and must never
// emit model-supplied markup. The crash this replaced came from pulling jsdom in to fake
// a DOM so that a DOM-based sanitizer could run on the server.
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './sanitize-markdown';

describe('renderMarkdown without a DOM', () => {
    it('renders markdown rather than degrading to empty output', () => {
        expect(renderMarkdown('**hello** _world_')).toBe('<p><strong>hello</strong> <em>world</em></p>\n');
    });

    it('tolerates empty and nullish input', () => {
        expect(renderMarkdown('')).toBe('');
        expect(renderMarkdown(undefined as unknown as string)).toBe('');
    });

    it('sanitizes with no DOM available', () => {
        expect(renderMarkdown('<iframe src="https://evil.com"></iframe>')).not.toContain('<iframe');
    });
});

describe('renderMarkdown allowlist', () => {
    it('keeps the tags the report styles cover', () => {
        expect(renderMarkdown('- one\n- two')).toContain('<li>one</li>');
        expect(renderMarkdown('> quoted')).toContain('<blockquote>');
        expect(renderMarkdown('---')).toContain('<hr>');
        expect(renderMarkdown('## Two\n### Three\n#### Four')).toContain('<h3>Three</h3>');
    });

    it('degrades tags outside the allowlist to their text content', () => {
        const headings = renderMarkdown('# One\n##### Five');
        expect(headings).not.toContain('<h1>');
        expect(headings).not.toContain('<h5>');
        expect(headings).toContain('One');
        expect(headings).toContain('Five');

        const table = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
        expect(table).not.toContain('<table');
        expect(table).toContain('a');
        expect(table).toContain('1');
    });

    it('drops images entirely', () => {
        expect(renderMarkdown('![alt](https://evil.com/x.png)')).not.toContain('<img');
    });

    it('honours the breaks option for single newlines', () => {
        expect(renderMarkdown('line one\nline two')).toContain('<br>');
    });
});

describe('renderMarkdown hostile input', () => {
    it('drops script tags and their body', () => {
        const result = renderMarkdown('hello <script>alert("xss")</script> world');
        expect(result).not.toContain('<script');
        expect(result).not.toContain('alert');
    });

    it('drops inline event handlers', () => {
        expect(renderMarkdown('<img src=x onerror="alert(1)">')).not.toContain('onerror');
        expect(renderMarkdown('before <b onclick="steal()">bold</b> after')).not.toContain('onclick');
        expect(renderMarkdown('<svg onload=alert(1)>')).not.toContain('onload');
    });

    it('drops style and class attributes', () => {
        const result = renderMarkdown('<p style="color:red" class="evil">hi</p>');
        expect(result).not.toContain('style=');
        expect(result).not.toContain('class=');
        expect(result).toContain('hi');
    });

    it('escapes HTML inside code fences instead of executing it', () => {
        expect(renderMarkdown('```\n<script>alert(1)</script>\n```')).toContain('&lt;script&gt;');
    });
});

describe('renderMarkdown links', () => {
    it('forces rel and target on safe links', () => {
        const result = renderMarkdown('[link](https://example.com)');
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('target="_blank"');
    });

    it('keeps relative and mailto links', () => {
        expect(renderMarkdown('[a](/app/running)')).toContain('href="/app/running"');
        expect(renderMarkdown('[a](mailto:x@example.com)')).toContain('href="mailto:x@example.com"');
    });

    it.each([['javascript:alert(1)'], ['JaVaScRiPt:alert(1)'], ['vbscript:msgbox(1)'], ['data:text/html,<b>x</b>']])(
        'empties the href for %s',
        (href) => {
            const result = renderMarkdown(`[click](${href})`);
            expect(result).not.toContain('javascript');
            expect(result).not.toContain('vbscript');
            expect(result).not.toContain('data:text/html');
            expect(result).toContain('click');
        },
    );

    it('cannot be broken out of the href attribute', () => {
        const result = renderMarkdown('[x](https://e.com/"onmouseover="alert(1))');
        expect(result).not.toContain('onmouseover=');
    });

    it('renders bare URLs as links via gfm autolinking', () => {
        expect(renderMarkdown('visit https://example.com now')).toContain('href="https://example.com"');
    });
});
