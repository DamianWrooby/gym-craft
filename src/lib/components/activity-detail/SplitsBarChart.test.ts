import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SplitsBarChart from './SplitsBarChart.svelte';
import type { ActivitySplit } from '$lib/server/garmin/fetch-activity-detail';

function split(splitIndex: number, averageSpeed: number, averageHr: number | null): ActivitySplit {
    return {
        splitIndex,
        distanceM: 1000,
        durationSec: 300,
        averageHr,
        averageSpeed,
        elevationGainM: null,
        elevationLossM: null,
    };
}

describe('SplitsBarChart', () => {
    it('renders a labelled chart with one label per usable split', () => {
        render(SplitsBarChart, {
            splits: [split(0, 3.3, 150), split(1, 3.5, 158), split(2, 3.1, 165)],
            activityType: 'running',
        });
        expect(screen.getByRole('img', { name: /pace by split/i })).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows an empty message when there are no usable splits', () => {
        render(SplitsBarChart, { splits: [], activityType: 'running' });
        expect(screen.getByText(/no split data/i)).toBeInTheDocument();
    });
});
