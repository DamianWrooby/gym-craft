import { describe, it, expect } from 'vitest';
import { splitRecommendations } from './split-recommendations';

describe('splitRecommendations', () => {
    it('returns the whole text as review when no recommendations heading is present', () => {
        const md = '## Summary\nYou ran great this week.';
        const { review, recommendations } = splitRecommendations(md);
        expect(review).toBe(md);
        expect(recommendations).toBeNull();
    });

    it('splits at "## Recommended adjustments for next week"', () => {
        const md =
            '## Summary\nGreat week.\n\n## Recommended adjustments for next week\n- Reduce volume by 10%';
        const { review, recommendations } = splitRecommendations(md);
        expect(review).toBe('## Summary\nGreat week.');
        expect(recommendations).toBe(
            '## Recommended adjustments for next week\n- Reduce volume by 10%',
        );
    });

    it('matches case-insensitively and tolerates wording variations', () => {
        const md = '# Recap\n...\n### Recommended Adjustment for Next Week\n- Hold steady';
        const { recommendations } = splitRecommendations(md);
        expect(recommendations).toContain('Recommended Adjustment');
    });

    it('handles empty input', () => {
        expect(splitRecommendations('')).toEqual({ review: '', recommendations: null });
    });
});
