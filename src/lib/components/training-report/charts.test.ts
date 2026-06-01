import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';

afterEach(() => cleanup());
import StatDeltas from './StatDeltas.svelte';
import HrZoneDonut from './HrZoneDonut.svelte';
import PaceHrScatter from './PaceHrScatter.svelte';

describe('StatDeltas', () => {
    it('renders nothing when deltas is null', () => {
        const { container } = render(StatDeltas, { deltas: null });
        expect(container.querySelector('[role="group"]')).toBeNull();
    });

    it('renders four cards including avg HR when delta is present', () => {
        const { container, getByText } = render(StatDeltas, {
            deltas: { distanceM: 2000, durationSec: 600, vigorousMinutes: 5, avgHRDelta: -2.5 },
        });
        expect(container.querySelector('[role="group"]')).not.toBeNull();
        expect(getByText('+2.00 km')).toBeTruthy();
        expect(getByText('+10 min')).toBeTruthy();
        expect(getByText('+5 min')).toBeTruthy();
        expect(getByText('−2.5 bpm')).toBeTruthy();
    });

    it('omits the avg HR card when avgHRDelta is null', () => {
        const { queryByText } = render(StatDeltas, {
            deltas: { distanceM: 0, durationSec: 0, vigorousMinutes: 0, avgHRDelta: null },
        });
        expect(queryByText(/bpm/)).toBeNull();
    });
});

describe('HrZoneDonut', () => {
    it('renders nothing when zones are null', () => {
        const { container } = render(HrZoneDonut, { hrZoneSeconds: null, hrZonePercents: null });
        expect(container.querySelector('[role="img"]')).toBeNull();
    });

    it('renders five colored zone slices with an accessible label', () => {
        const { container } = render(HrZoneDonut, {
            hrZoneSeconds: { zone1: 600, zone2: 600, zone3: 300, zone4: 0, zone5: 0 },
            hrZonePercents: { zone1: 40, zone2: 40, zone3: 20, zone4: 0, zone5: 0 },
        });
        const wrapper = container.querySelector('[role="img"]');
        expect(wrapper?.getAttribute('aria-label')).toContain('Heart rate zone distribution');
        expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
    });
});

describe('PaceHrScatter', () => {
    it('renders nothing when there are no valid points', () => {
        const { container } = render(PaceHrScatter, {
            efficiency: {
                perActivity: [{ activityId: 1, avgPaceSecPerKm: null, avgHR: null }],
                averagePaceSecPerKm: null,
                averageHR: null,
            },
        });
        expect(container.querySelector('[role="img"]')).toBeNull();
    });

    it('renders an svg with one circle per valid point and an aria-label', () => {
        const { container } = render(PaceHrScatter, {
            efficiency: {
                perActivity: [
                    { activityId: 1, avgPaceSecPerKm: 360, avgHR: 145 },
                    { activityId: 2, avgPaceSecPerKm: 330, avgHR: 158 },
                    { activityId: 3, avgPaceSecPerKm: null, avgHR: null }, // ignored
                ],
                averagePaceSecPerKm: 345,
                averageHR: 151,
            },
        });
        const circles = container.querySelectorAll('circle');
        expect(circles.length).toBe(2);
        const wrapper = container.querySelector('[role="img"]');
        expect(wrapper?.getAttribute('aria-label')).toContain('Pace vs HR');
    });
});
