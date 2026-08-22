import type { RoutePoint } from '$lib/server/garmin/fetch-activity-detail';

const EARTH_R = 6371000;

/** Haversine distance in meters. */
function distanceM(a: RoutePoint, b: RoutePoint): number {
	const dLat = ((b.lat - a.lat) * Math.PI) / 180;
	const dLng = ((b.lng - a.lng) * Math.PI) / 180;
	const lat1 = (a.lat * Math.PI) / 180;
	const lat2 = (b.lat * Math.PI) / 180;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/**
 * Removes points within `radiusM` of the route's start AND end, so the athlete's home
 * location is not exposed. Returns [] when the result would be degenerate.
 */
export function trimRoute(route: RoutePoint[], radiusM: number): RoutePoint[] {
	if (route.length < 3) return [];
	const start = route[0];
	const end = route[route.length - 1];
	const trimmed = route.filter(
		(p) => distanceM(p, start) > radiusM && distanceM(p, end) > radiusM,
	);
	return trimmed.length >= 2 ? trimmed : [];
}

/**
 * Projects lat/lng into an SVG path fitted to `maxDim` px on its longer axis, preserving
 * aspect ratio via a cos(lat) longitude correction. Y is flipped (north up).
 */
export function routeToSvgPath(route: RoutePoint[], maxDim: number): { d: string; width: number; height: number } {
	if (route.length < 2) return { d: '', width: 0, height: 0 };
	const lats = route.map((p) => p.lat);
	const lngs = route.map((p) => p.lng);
	const minLat = Math.min(...lats);
	const maxLat = Math.max(...lats);
	const minLng = Math.min(...lngs);
	const maxLng = Math.max(...lngs);
	const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);

	const spanX = (maxLng - minLng) * Math.cos(midLat);
	const spanY = maxLat - minLat;
	const scale = maxDim / Math.max(spanX, spanY, 1e-9);
	const width = Math.max(spanX * scale, 1);
	const height = Math.max(spanY * scale, 1);

	const d = route
		.map((p, i) => {
			const x = (p.lng - minLng) * Math.cos(midLat) * scale;
			const y = height - (p.lat - minLat) * scale;
			return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(' ');

	return { d, width, height };
}
