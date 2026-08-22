import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import HrZoneBar from './HrZoneBar.svelte';

describe('HrZoneBar', () => {
    it('renders a segment per non-zero zone with an accessible label', () => {
        render(HrZoneBar, { zones: { zone1: 60, zone2: 120, zone3: 0, zone4: 0, zone5: 0 } });
        expect(screen.getByRole('img', { name: /heart rate zone distribution/i })).toBeInTheDocument();
        expect(screen.getByText(/Z1/)).toBeInTheDocument();
        expect(screen.getByText(/Z2/)).toBeInTheDocument();
    });
});
