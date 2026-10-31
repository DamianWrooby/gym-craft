import { describe, expect, it } from 'vitest';
import { isValidZones, proposeZones, zonesIssue } from './zones';

const profileZones = [
    { zone: 1, lowerBpm: 95, upperBpm: 120 },
    { zone: 2, lowerBpm: 121, upperBpm: 140 },
    { zone: 3, lowerBpm: 141, upperBpm: 155 },
    { zone: 4, lowerBpm: 156, upperBpm: 170 },
    { zone: 5, lowerBpm: 171, upperBpm: 190 },
];

describe('proposeZones', () => {
    it('prefills from the profile (synced from Garmin) when valid zones exist', () => {
        expect(proposeZones({ existing: profileZones, maxHR: 200, age: 30 })).toEqual({
            source: 'profile',
            zones: profileZones,
        });
    });

    it('proposes from max HR when no zones exist', () => {
        expect(proposeZones({ existing: null, maxHR: 200, age: 30 })).toEqual({
            source: 'max-hr',
            zones: [
                { zone: 1, lowerBpm: 100, upperBpm: 120 },
                { zone: 2, lowerBpm: 121, upperBpm: 140 },
                { zone: 3, lowerBpm: 141, upperBpm: 160 },
                { zone: 4, lowerBpm: 161, upperBpm: 180 },
                { zone: 5, lowerBpm: 181, upperBpm: 200 },
            ],
        });
    });

    it('proposes from age (208 − 0.7 × age) when max HR is missing', () => {
        const p = proposeZones({ existing: [{ zone: 1 }], maxHR: null, age: 40 });
        expect(p?.source).toBe('age');
        expect(p?.zones[4].upperBpm).toBe(180);
    });

    it('proposes nothing without zones, max HR or age', () => {
        expect(proposeZones({ existing: null, maxHR: null, age: null })).toBeNull();
    });
});

describe('isValidZones', () => {
    it.each([
        ['four zones', profileZones.slice(0, 4)],
        ['overlapping zones', [...profileZones.slice(0, 4), { zone: 5, lowerBpm: 160, upperBpm: 190 }]],
        ['upper under lower', [{ zone: 1, lowerBpm: 120, upperBpm: 100 }, ...profileZones.slice(1)]],
    ])('rejects %s', (_, zones) => {
        expect(isValidZones(zones)).toBe(false);
    });
});

describe('zonesIssue', () => {
    // The wizard screenshot in #397's follow-up: zone 4 ends at 193 and zone 5 starts at 193.
    const screenshot = [
        { zone: 1, lowerBpm: 78, upperBpm: 130 },
        { zone: 2, lowerBpm: 131, upperBpm: 162 },
        { zone: 3, lowerBpm: 163, upperBpm: 178 },
        { zone: 4, lowerBpm: 179, upperBpm: 193 },
        { zone: 5, lowerBpm: 193, upperBpm: 195 },
    ];

    it('names the overlapping zone and where the previous one ends', () => {
        expect(zonesIssue(screenshot)).toEqual({ kind: 'overlap', zone: 5, previousUpper: 193 });
    });

    it('names a zone whose upper bound is not above its lower bound', () => {
        expect(zonesIssue([{ zone: 1, lowerBpm: 120, upperBpm: 100 }, ...screenshot.slice(1)])).toEqual({
            kind: 'range',
            zone: 1,
        });
    });

    it('names an empty bound and an upper bound over the limit', () => {
        expect(zonesIssue([screenshot[0], { zone: 2, lowerBpm: 131, upperBpm: NaN }, ...screenshot.slice(2)])).toEqual({
            kind: 'missing',
            zone: 2,
        });
        expect(zonesIssue([...screenshot.slice(0, 4), { zone: 5, lowerBpm: 194, upperBpm: 260 }])).toEqual({
            kind: 'max',
            zone: 5,
        });
    });

    it('reports the count only when there are not five zones, and nothing for valid zones', () => {
        expect(zonesIssue(screenshot.slice(0, 4))).toEqual({ kind: 'count' });
        expect(zonesIssue([...screenshot.slice(0, 4), { zone: 5, lowerBpm: 194, upperBpm: 200 }])).toBeNull();
    });
});
