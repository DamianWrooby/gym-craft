import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import Markdown from './Markdown.svelte';

afterEach(() => cleanup());

function html(source: string): string {
    const { container } = render(Markdown, { source });
    return container.innerHTML;
}

describe('Markdown component', () => {
    it('renders basic markdown to HTML', () => {
        const result = html('**hello** _world_');
        expect(result).toContain('<strong>hello</strong>');
        expect(result).toContain('<em>world</em>');
    });

    it('renders heading levels h2-h4', () => {
        const result = html('## Two\n### Three\n#### Four');
        expect(result).toContain('<h2>Two</h2>');
        expect(result).toContain('<h3>Three</h3>');
        expect(result).toContain('<h4>Four</h4>');
    });

    it('renders lists', () => {
        const result = html('- one\n- two\n- three');
        expect(result).toContain('<li>one</li>');
        expect(result).toContain('<li>two</li>');
    });

    it('strips <script> tags entirely', () => {
        const result = html('hello <script>alert("xss")</script> world');
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('alert');
    });

    it('strips inline event handlers from images and other tags', () => {
        const result = html('<img src=x onerror="alert(1)">');
        expect(result).not.toContain('onerror');
        expect(result).not.toContain('alert');
    });

    it('strips javascript: URLs from links', () => {
        const result = html('[click](javascript:alert(1))');
        expect(result).not.toContain('javascript:');
    });

    it('strips style and class attributes', () => {
        const result = html('<p style="color:red" class="evil">hi</p>');
        expect(result).not.toContain('style=');
        expect(result).not.toContain('class="evil"');
    });

    it('forces rel="noopener noreferrer" and target="_blank" on anchors', () => {
        const result = html('[link](https://example.com)');
        expect(result).toContain('href="https://example.com"');
        expect(result).toContain('rel="noopener noreferrer"');
        expect(result).toContain('target="_blank"');
    });

    it('strips iframes and other disallowed tags', () => {
        const result = html('<iframe src="https://evil.com"></iframe>');
        expect(result).not.toContain('<iframe');
    });

    it('renders empty content without crashing', () => {
        const result = html('');
        expect(result).toContain('class="markdown');
    });
});
