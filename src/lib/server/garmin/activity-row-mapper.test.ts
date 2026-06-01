import { describe, expect, it } from 'vitest';
import { toActivityListItem } from './activity-row-mapper';
import type { Activity } from '@prisma/client';

const row: Activity = {
    id: 'row-1',
    userId: 'user-1',
    garminActivityId: BigInt(1234567890),
    activityType: 'running',
    activityName: 'Morning run',
    startTime: new Date('2026-05-20T07:30:00Z'),
    durationSec: 3600,
    movingDurationSec: 3500,
    distanceM: 10000,
    calories: 700,
    averageHr: 150,
    maxHr: 175,
    hrZone1Sec: 100,
    hrZone2Sec: 200,
    hrZone3Sec: 1500,
    hrZone4Sec: 1500,
    hrZone5Sec: 300,
    moderateMinutes: 20,
    vigorousMinutes: 40,
    averageSpeed: 2.78,
    maxSpeed: 4.5,
    averageCadence: 175,
    maxCadence: 190,
    avgStrideLength: 1.2,
    elevationGainM: 50,
    elevationLossM: 50,
    trimpLoad: 80,
    raw: {},
    fetchedAt: new Date(),
};

describe('toActivityListItem', () => {
    it('maps required fields from the Activity row', () => {
        const item = toActivityListItem(row);
        expect(item.id).toBe('row-1');
        expect(item.garminActivityId).toBe('1234567890');
        expect(item.activityType).toBe('running');
        expect(item.activityName).toBe('Morning run');
        expect(item.startTime).toBe('2026-05-20T07:30:00.000Z');
        expect(item.durationSec).toBe(3600);
        expect(item.distanceM).toBe(10000);
        expect(item.averageHr).toBe(150);
        expect(item.averageSpeed).toBe(2.78);
        expect(item.elevationGainM).toBe(50);
        expect(item.calories).toBe(700);
    });

    it('serializes BigInt garminActivityId as a string', () => {
        const item = toActivityListItem(row);
        expect(typeof item.garminActivityId).toBe('string');
    });

    it('passes through null activityName', () => {
        const item = toActivityListItem({ ...row, activityName: null });
        expect(item.activityName).toBeNull();
    });
});
