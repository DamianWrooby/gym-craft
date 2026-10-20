import { describe, expect, it } from 'vitest';
import { stepLines } from './session-format';

describe('stepLines', () => {
    it('shows each step with its amount, the school label name and its target', () => {
        const lines = stepLines(
            [
                { label: 'E', durationSec: 600, note: 'Relaxed' },
                {
                    repeat: 5,
                    steps: [
                        { label: 'I', distanceM: 1000, target: { type: 'PACE', minSecPerKm: 230, maxSecPerKm: 241 } },
                        { label: 'E', durationSec: 150 },
                    ],
                },
            ],
            'DANIELS',
        );
        expect(lines).toEqual([
            { text: '10 min · Easy', note: 'Relaxed', nested: false },
            { text: '5 ×', nested: false },
            { text: '1 km · Interval · 3:50–4:01 /km', note: undefined, nested: true },
            { text: '2:30 min · Easy', note: undefined, nested: true },
        ]);
    });

    it('shows a heart-rate target in bpm', () => {
        const [line] = stepLines(
            [{ label: 'z1', durationSec: 2700, target: { type: 'HR', lowerBpm: 95, upperBpm: 133 } }],
            'POLARIZED',
        );
        expect(line.text).toBe('45 min · Zone 1 (easy) · 95–133 bpm');
    });
});
