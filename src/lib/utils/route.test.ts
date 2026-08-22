import { describe, it, expect } from 'vitest';
import { trimRoute, routeToSvgPath } from './route';
import type { RoutePoint } from '$lib/server/garmin/fetch-activity-detail';

const line: RoutePoint[] = Array.from({ length: 100 }, (_, i) => ({ lat: 50 + i * 0.001, lng: 19 }));

describe('trimRoute', () => {
	it('drops points within the trim radius of the first and last point', () => {
		const trimmed = trimRoute(line, 200);
		expect(trimmed.length).toBeLessThan(line.length);
		expect(trimmed.length).toBeGreaterThan(0);
	});
	it('returns [] for an empty or tiny route', () => {
		expect(trimRoute([], 200)).toEqual([]);
		expect(trimRoute(line.slice(0, 2), 200)).toEqual([]);
	});
});

describe('routeToSvgPath', () => {
	it('produces a path string scaled into the viewbox', () => {
		const { d, width, height } = routeToSvgPath(line, 300);
		expect(d.startsWith('M')).toBe(true);
		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});
	it('returns empty d for fewer than 2 points', () => {
		expect(routeToSvgPath([{ lat: 50, lng: 19 }], 300).d).toBe('');
	});
});
