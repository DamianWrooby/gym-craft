import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ActivityRow from './ActivityRow.svelte';

const activity = {
    id: 'a-1',
    garminActivityId: '111',
    activityType: 'running',
    activityName: 'Morning Run',
    startTime: '2026-06-06T07:00:00Z',
    durationSec: 1800,
    distanceM: 5000,
    calories: 350,
    averageHr: 145,
    averageSpeed: 2.78,
    elevationGainM: 25,
    trimpLoad: 40,
};

describe('ActivityRow', () => {
    it('renders name and distance and links to the nested detail path', () => {
        render(ActivityRow, { activity });
        expect(screen.getByText('Morning Run')).toBeInTheDocument();
        expect(screen.getByText('5.00 km')).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', '/app/running/analytics/activities/111');
    });
});
