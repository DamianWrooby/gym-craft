import { describe, expect, it } from 'vitest';
import { SCHOOLS } from '$lib/planner/schools/catalogue';
import { buildWeekPrompt, type WeekPromptInput } from './week-prompt';

const everyDay = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true };

const prompt = (from: string, availability: WeekPromptInput['availability'] = everyDay, sameDaySessions = true) =>
    buildWeekPrompt({
        school: SCHOOLS[0],
        phase: { name: 'Base', intent: 'Build', source: 'SCHOOL' },
        week: {
            startDate: '2026-10-26',
            from,
            to: '2026-11-01',
            isCutback: false,
            isTaper: false,
            volumeTarget: 60,
            volumeUnit: 'MINUTES',
            strengthSessionTarget: 2,
            timeTrialDistanceM: null,
        },
        availability,
        longRunDay: 6,
        sameDaySessions,
        anchor: null,
    }).user;

describe('buildWeekPrompt: strength sessions', () => {
    it('states the same-day rule only when the athlete keeps lifts and runs apart', () => {
        expect(prompt('2026-10-26')).not.toContain('on the same day');
        expect(prompt('2026-10-26', everyDay, false)).toContain('on the same day');
    });

    it('keeps the target when the week has room', () => {
        expect(prompt('2026-10-26')).toContain('Strength sessions: exactly 2.');
    });

    it('asks for no lift when only the long-run day is left in the week', () => {
        expect(prompt('2026-11-01')).toContain('Strength sessions: exactly 0.');
    });

    it('caps the target at the training days other than the long-run day', () => {
        expect(prompt('2026-10-31')).toContain('Strength sessions: exactly 1.');
    });

    it('does not count a day the athlete cannot train', () => {
        expect(prompt('2026-10-31', { ...everyDay, sat: false })).toContain('Strength sessions: exactly 0.');
    });
});
