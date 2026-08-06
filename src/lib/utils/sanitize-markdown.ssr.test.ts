// @vitest-environment node
//
// Guards the server-render path. Importing the sanitizer without a DOM must not throw
// (the crash this replaced came from pulling jsdom in to fake one), and it must never
// emit unsanitized model output.
import { describe, expect, it } from 'vitest';
import { renderMarkdown, renderMarkdownForPdf } from './sanitize-markdown';

describe('sanitize-markdown without a DOM', () => {
    it('renders nothing rather than unsanitized HTML', () => {
        expect(renderMarkdown('**hello** <script>alert(1)</script>')).toBe('');
        expect(renderMarkdownForPdf('## Coach review')).toBe('');
    });

    it('tolerates empty and nullish input', () => {
        expect(renderMarkdown('')).toBe('');
        expect(renderMarkdown(undefined as unknown as string)).toBe('');
    });
});
