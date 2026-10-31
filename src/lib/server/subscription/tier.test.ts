import { describe, expect, it } from 'vitest';
import { resolveTier } from './tier';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('resolveTier', () => {
    it('returns FREE for a brand-new user', () => {
        expect(resolveTier({ subscriptionStatus: null, currentPeriodEnd: null })).toBe('FREE');
    });

    it('returns SUPPORTER for an active subscription that has not expired', () => {
        expect(resolveTier({ subscriptionStatus: 'active', currentPeriodEnd: future })).toBe('SUPPORTER');
    });

    it('returns FREE for an active subscription whose period has ended', () => {
        expect(resolveTier({ subscriptionStatus: 'active', currentPeriodEnd: past })).toBe('FREE');
    });

    it('returns FREE for a canceled subscription', () => {
        expect(resolveTier({ subscriptionStatus: 'canceled', currentPeriodEnd: future })).toBe('FREE');
    });
});
