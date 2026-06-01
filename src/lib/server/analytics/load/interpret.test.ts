import { describe, it, expect } from 'vitest';
import { interpretAcwr, interpretMonotony } from './interpret';

describe('interpretAcwr', () => {
    it('classifies 0 ACWR as undertraining', () => {
        expect(interpretAcwr(0).status).toBe('undertraining');
    });

    it('classifies <0.8 as undertraining', () => {
        expect(interpretAcwr(0.6).status).toBe('undertraining');
    });

    it('classifies the 0.8–1.3 sweet spot as optimal', () => {
        expect(interpretAcwr(0.9).status).toBe('optimal');
        expect(interpretAcwr(1.0).status).toBe('optimal');
        expect(interpretAcwr(1.3).status).toBe('optimal');
    });

    it('classifies 1.3–1.5 as overreach', () => {
        expect(interpretAcwr(1.4).status).toBe('overreach');
    });

    it('classifies >1.5 as high-risk', () => {
        expect(interpretAcwr(1.7).status).toBe('high-risk');
    });
});

describe('interpretMonotony', () => {
    it('flags monotony >= 2 as elevated', () => {
        expect(interpretMonotony(2.1).isHigh).toBe(true);
    });

    it('does not flag healthy variation', () => {
        expect(interpretMonotony(1.4).isHigh).toBe(false);
    });

    it('flags infinity (identical daily loads) as high', () => {
        expect(interpretMonotony(Infinity).isHigh).toBe(true);
    });
});
