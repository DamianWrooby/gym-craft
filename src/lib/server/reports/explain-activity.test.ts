import { describe, it, expect } from 'vitest';
import { buildExplainPrompt, type ExplainActivityParams } from './explain-activity';
import type { ActivityDetailPayload } from '$lib/server/garmin/fetch-activity-detail';

function baseActivity(overrides: Partial<ExplainActivityParams['activity']> = {}): ExplainActivityParams['activity'] {
    return {
        garminActivityId: BigInt(123),
        activityType: 'running',
        activityName: 'Tempo run',
        startTime: new Date('2026-06-01T15:50:00Z'),
        durationSec: 6055,
        distanceM: 20010,
        averageHr: 164,
        maxHr: 183,
        hrZone1Sec: 0,
        hrZone2Sec: 0,
        hrZone3Sec: 0,
        hrZone4Sec: 0,
        hrZone5Sec: 0,
        averageSpeed: 3.31, // ≈ 5:02 /km
        averageCadence: 180,
        avgStrideLength: 1.1,
        elevationGainM: 50,
        elevationLossM: 50,
        trimpLoad: 200,
        ...overrides,
    };
}

const detail: ActivityDetailPayload = {
    activityId: 123,
    activityName: 'Tempo run',
    activityType: 'running',
    startTimeGMT: '2026-06-01 15:50:00',
    duration: 6055,
    distance: 20010,
    splits: [{ splitIndex: 0, distanceM: 1000, durationSec: 287, averageHr: 152, averageSpeed: 3.48, elevationGainM: 4, elevationLossM: 2 }],
    samples: [
        { timestampSec: 0, heartRate: 110, speed: 3.0, elevationM: 100 },
        { timestampSec: 5, heartRate: 114, speed: 0, elevationM: 100 },
    ],
};

function parsePayload(user: string) {
    const json = user.slice(user.indexOf('{'), user.lastIndexOf('}') + 1);
    return JSON.parse(json);
}

const baseParams = (over: Partial<ExplainActivityParams> = {}): ExplainActivityParams => ({
    question: 'Why did I fade?',
    activity: baseActivity(),
    detail,
    recentActivities: [],
    loadProfile: null,
    profile: null,
    ...over,
});

describe('buildExplainPrompt — pace enrichment', () => {
    it('sends pre-computed pace for the activity and labels speed in m/s', () => {
        const { user } = buildExplainPrompt(baseParams());
        const payload = parsePayload(user);

        expect(payload.activity.avgPaceSecPerKm).toBe(302);
        expect(payload.activity.avgPace).toBe('5:02 /km');
        expect(payload.activity.averageSpeedMps).toBe(3.31);
        // The ambiguous unlabeled field must be gone.
        expect(payload.activity.averageSpeed).toBeUndefined();
    });

    it('enriches splits with pace and renames speed', () => {
        const { user } = buildExplainPrompt(baseParams());
        const split = parsePayload(user).splits[0];

        expect(split.paceSecPerKm).toBe(287);
        expect(split.pace).toBe('4:47 /km');
        expect(split.averageSpeedMps).toBe(3.48);
        expect(split.averageSpeed).toBeUndefined();
    });

    it('sends numeric sample pace and null for stopped samples', () => {
        const { user } = buildExplainPrompt(baseParams());
        const samples = parsePayload(user).samples;

        expect(samples[0].paceSecPerKm).toBe(333);
        expect(samples[1].paceSecPerKm).toBeNull(); // speed 0
        expect(samples[0].speed).toBeUndefined();
    });

    it('keeps raw m/s (no pace) for non-pace activities like cycling', () => {
        const { user } = buildExplainPrompt(
            baseParams({ activity: baseActivity({ activityType: 'cycling' }) }),
        );
        const payload = parsePayload(user);

        expect(payload.activity.avgPace).toBeUndefined();
        expect(payload.activity.averageSpeedMps).toBe(3.31);
        expect(payload.samples[0].speedMps).toBe(3.0);
        expect(payload.samples[0].paceSecPerKm).toBeUndefined();
    });
});
