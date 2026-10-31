import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import RouteThumbnail from './RouteThumbnail.svelte';
import type { RoutePoint } from '$lib/server/garmin/fetch-activity-detail';

const route: RoutePoint[] = Array.from({ length: 60 }, (_, i) => ({ lat: 50 + i * 0.001, lng: 19 + i * 0.0005 }));

describe('RouteThumbnail', () => {
    it('renders an svg when the trimmed route has points', () => {
        render(RouteThumbnail, { route });
        expect(screen.getByRole('img', { name: /route/i })).toBeInTheDocument();
    });
    it('renders nothing usable for an empty route', () => {
        const { container } = render(RouteThumbnail, { route: [] });
        expect(container.querySelector('svg')).toBeNull();
    });
});
