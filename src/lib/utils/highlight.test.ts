import { describe, expect, it } from 'vitest';
import { highlight } from './highlight';

describe('highlight', () => {
    it('wraps marked phrases in an accent span', () => {
        expect(highlight('Build [[training load]] now')).toBe(
            'Build <span class="text-secondary-400">training load</span> now',
        );
    });

    it('escapes markup in the copy', () => {
        expect(highlight('a <b> [[c]]')).toBe('a &lt;b> <span class="text-secondary-400">c</span>');
    });
});
