import { judged, sourced, type SchoolDefinition, type SchoolId } from './types';

// Sources: docs/research/phase-floors-and-droppable-flags.md (#374, #377) and
// docs/research/volume-ramp-and-strength-cadence.md (#380). "Transcribed" values reach the
// book through a reviewer; they are marked sourced with the note saying so.

const POLARIZED: SchoolDefinition = {
    id: 'POLARIZED',
    name: 'Polarized 80/20',
    lore: 'Seiler found that endurance athletes everywhere train about 80 % easy and 20 % hard. Fitzgerald turned it into plans: most runs truly easy, a few truly hard, and very little in between.',
    tagline: '80 % easy, 20 % hard, all season.',
    phases: [
        {
            key: 'aerobic',
            name: 'Aerobic',
            intent: '80 % easy, 20 % hard, all season.',
            lossLine: 'Fewer weeks of 80/20 training means less aerobic base on race day.',
            idealWeeks: judged(14, 'No source states a length; 16-week plans with a 2-week taper.'),
            floorWeeks: judged(7, '9-week shortest 80/20 plan minus the sourced 2-week taper.'),
            droppable: judged(false, 'The aerobic phase is the school.'),
            volumeUnit: 'MINUTES',
            strengthKind: 'base',
        },
        {
            key: 'taper',
            name: 'Taper',
            intent: 'Same mix, less volume.',
            lossLine: 'The taper never shrinks.',
            idealWeeks: sourced(2, 'Warden, 80/20 Endurance: "our two week taper".'),
            floorWeeks: sourced(2, 'Warden, 80/20 Endurance; Wang et al. 2023.'),
            droppable: sourced(false, 'Warden, 80/20 Endurance.'),
            volumeUnit: 'MINUTES',
            strengthKind: 'sharpen',
        },
    ],
    compressionOrder: judged(['aerobic'], 'The aerobic phase absorbs everything; the taper never moves.'),
    dropOrder: judged([], 'Nothing is droppable.'),
    schoolFloorWeeks: judged(9, 'Shortest published 80/20 plan; Stöggl & Sperlich 2014 9-week effect.'),
    peak: {
        kind: 'clamp',
        multipleOfRecent: judged(1.25),
        min: judged(180, 'Minutes per week.'),
        max: judged(600, 'Minutes per week.'),
    },
    ramp: {
        kind: 'linear',
        startFractionOfPeak: judged(0.75),
        maxStepFraction: judged(0.08),
    },
    cutbackCadence: judged(3, 'Fitzgerald states a repeating step pattern exists but not its length.'),
    cutbackDepth: judged(0.2),
    taperFractions: judged([0.7, 0.5], 'Volume cut 41–60 % per Wang et al. 2023.'),
    leadIn: {
        split: judged('80/20: one moderate-to-hard session a week from lead-in week 3'),
        touch: judged('strides'),
    },
    intensityLabels: [
        {
            key: 'z1',
            name: 'Zone 1 (easy)',
            edwardsWeight: judged(2),
            targetType: sourced('HR', 'Seiler three-zone model is heart-rate based.'),
        },
        {
            key: 'z2',
            name: 'Zone 2 (moderate)',
            edwardsWeight: judged(3),
            targetType: sourced('HR', 'Seiler three-zone model.'),
        },
        {
            key: 'z3',
            name: 'Zone 3 (hard)',
            edwardsWeight: judged(4.5),
            targetType: sourced('HR', 'Seiler three-zone model.'),
        },
    ],
    keySessions: [
        { key: 'hard', name: 'Hard session', reason: 'The 20 % that drives adaptation.' },
        { key: 'long', name: 'Long run', reason: 'Builds aerobic duration.' },
    ],
    cutOrder: judged(['recovery', 'foundation'], 'Recovery runs first, then foundation runs, shortest first.'),
    strengthTemplates: [
        { key: 'heavy-full-body', name: 'Heavy full body', tag: 'heavy' },
        { key: 'light-maintenance', name: 'Light maintenance', tag: 'light' },
    ],
};

const MILE = 1609;

const DANIELS: SchoolDefinition = {
    id: 'DANIELS',
    name: 'Daniels',
    lore: 'Jack Daniels coached Olympians and wrote the Running Formula. Every pace comes from your race result through his VDOT tables, and every week is built around two quality days.',
    tagline: 'Precise paces from your race result.',
    phases: [
        {
            key: 'fi',
            name: 'Foundation',
            intent: 'Easy mileage and strides to build resilience.',
            lossLine: 'Without Foundation there is no easy weeks to absorb the quality work.',
            idealWeeks: sourced(6, 'Transcribed: ~6 weeks per phase.'),
            floorWeeks: judged(3, 'No Daniels source gives a Phase I minimum.'),
            droppable: sourced(true, 'Transcribed: "Skip if you\'re already good to go".'),
            autoSatisfiedAboveRecentMetres: judged(16000, 'FI is satisfied by a lead-in or by running ~16 km a week.'),
            volumeUnit: 'METRES',
            strengthKind: 'base',
        },
        {
            key: 'eq',
            name: 'Early Quality',
            intent: 'Reps and light threshold.',
            lossLine: 'Without Early Quality there is no repetition work to build speed and economy.',
            idealWeeks: sourced(6, 'Transcribed: ~6 weeks per phase.'),
            floorWeeks: sourced(4, 'Transcribed: "try to keep minimum 4".'),
            droppable: sourced(true, 'Transcribed drop order: FI, FQ, TQ, finally EQ.'),
            volumeUnit: 'METRES',
            strengthKind: 'base',
        },
        {
            key: 'tq',
            name: 'Transition Quality',
            intent: 'Intervals: the hardest phase.',
            lossLine: 'Without Transition Quality there is no interval weeks to raise your VO2max.',
            idealWeeks: sourced(6, 'Transcribed: ~6 weeks per phase.'),
            floorWeeks: sourced(4, 'Transcribed: "Keep at least 4 weeks of this phase".'),
            droppable: sourced(true, 'Transcribed drop order.'),
            volumeUnit: 'METRES',
            strengthKind: 'build',
        },
        {
            key: 'fq',
            name: 'Final Quality',
            intent: 'Threshold and race pace, sharpen.',
            lossLine: 'Final Quality is never dropped.',
            idealWeeks: sourced(6, 'Transcribed: ~6 weeks per phase.'),
            floorWeeks: sourced(4, 'Transcribed: "Again keep minimum 4 weeks".'),
            droppable: sourced(false, 'Transcribed drop order.'),
            volumeUnit: 'METRES',
            strengthKind: 'sharpen',
        },
    ],
    compressionOrder: judged(['eq', 'tq'], 'Follows the drop order: EQ before TQ, never FQ.'),
    dropOrder: sourced(['eq', 'tq'], 'Transcribed: "FI, FQ, TQ, and finally EQ"; FI is auto-satisfied.'),
    schoolFloorWeeks: judged(8, 'TQ + FQ floors; FQ alone would be a taper wearing the name.'),
    peak: {
        kind: 'tiers',
        tiers: sourced(
            [40, 55, 70, 85, 100, 120].map((mi) => mi * MILE),
            'Transcribed: 2Q plan peaks in miles (runningwithrock).',
        ),
    },
    ramp: {
        kind: 'step-hold',
        stepPerRunPerWeek: sourced(MILE, 'Daniels 1998 p.21: ≤ 1 mile per session per week.'),
        holdWeeks: judged(3, 'From "hold 3–4 weeks".'),
    },
    cutbackCadence: sourced(null, 'Daniels places no calendar cutback; the cap governs.'),
    cutbackDepth: sourced(0.2, 'Transcribed: the 0.8 weeks of the 2Q table.'),
    taperFractions: judged([0.8, 0.6]),
    leadIn: { split: judged('100/0: easy running only'), touch: judged('strides') },
    intensityLabels: [
        {
            key: 'E',
            name: 'Easy',
            edwardsWeight: judged(2),
            targetType: sourced('PACE'),
            paceDerivation: 'VDOT from the anchor, E pace from the Daniels tables.',
        },
        {
            key: 'M',
            name: 'Marathon',
            edwardsWeight: judged(3),
            targetType: sourced('PACE'),
            paceDerivation: 'VDOT from the anchor, M pace from the Daniels tables.',
        },
        {
            key: 'T',
            name: 'Threshold',
            edwardsWeight: judged(4),
            targetType: sourced('PACE'),
            paceDerivation: 'VDOT from the anchor, T pace from the Daniels tables.',
        },
        {
            key: 'I',
            name: 'Interval',
            edwardsWeight: judged(5),
            targetType: sourced('PACE'),
            paceDerivation: 'VDOT from the anchor, I pace from the Daniels tables.',
        },
        {
            key: 'R',
            name: 'Repetition',
            edwardsWeight: judged(5),
            targetType: sourced('PACE'),
            paceDerivation: 'VDOT from the anchor, R pace from the Daniels tables.',
        },
    ],
    keySessions: [
        { key: 'q1', name: 'Quality 1', reason: 'Quality day: the session this phase is built around.' },
        { key: 'q2', name: 'Quality 2', reason: 'Quality day: the session this phase is built around.' },
        { key: 'long', name: 'Long run', reason: 'The L run holds the week together.' },
    ],
    cutOrder: judged(['easy', 'strides'], 'E runs, then strides; the L run is shortened, never removed.'),
    strengthTemplates: [
        { key: 'heavy-full-body', name: 'Heavy full body', tag: 'heavy' },
        { key: 'light-maintenance', name: 'Light maintenance', tag: 'light' },
    ],
};

const PFITZINGER: SchoolDefinition = {
    id: 'PFITZINGER',
    name: 'Pfitzinger',
    lore: 'Pete Pfitzinger ran two Olympic marathons and wrote Advanced Marathoning. His plans pile up mileage, a medium-long run and weekly lactate-threshold work, all paced from your threshold.',
    tagline: 'High mileage and threshold work, built for the marathon.',
    phases: [
        {
            key: 'endurance',
            name: 'Endurance',
            intent: 'Build mileage and the long run.',
            lossLine: 'Fewer Endurance weeks means less mileage under you before the threshold work starts.',
            idealWeeks: sourced(6, 'Advanced Marathoning 18-week table: weeks-to-goal 17→12.'),
            floorWeeks: sourced(4, 'Transcribed 12-week plan: Endurance weeks 1–4.'),
            droppable: sourced(false, 'All four mesocycles survive into the 12-week plan.'),
            volumeUnit: 'METRES',
            strengthKind: 'base',
        },
        {
            key: 'lt',
            name: 'Lactate Threshold + Endurance',
            intent: 'Threshold volume on top of endurance.',
            lossLine: 'Fewer threshold weeks means a lower lactate threshold and a slower marathon pace.',
            idealWeeks: sourced(5, 'Advanced Marathoning 18-week table: weeks-to-goal 11→7.'),
            floorWeeks: sourced(3, 'Transcribed 12-week plan: LT weeks 5–7.'),
            droppable: sourced(false, 'All four mesocycles survive into the 12-week plan.'),
            volumeUnit: 'METRES',
            strengthKind: 'build',
        },
        {
            key: 'race-prep',
            name: 'Race Preparation',
            intent: 'VO2max and tune-up races.',
            lossLine: 'Fewer Race Preparation weeks means less VO2max work and fewer tune-up races.',
            idealWeeks: sourced(4, 'Advanced Marathoning 18-week table: weeks-to-goal 6→3.'),
            floorWeeks: sourced(3, 'Transcribed 12-week plan; one reviewer reads 2. 3 makes the floors sum to 12.'),
            droppable: sourced(false, 'All four mesocycles survive into the 12-week plan.'),
            volumeUnit: 'METRES',
            strengthKind: 'sharpen',
        },
        {
            key: 'taper',
            name: 'Taper',
            intent: 'Shed fatigue, keep sharpness.',
            lossLine: 'A shorter taper means reaching the start line less fresh.',
            idealWeeks: sourced(3, 'Advanced Marathoning 18-week table: weeks-to-goal 2→race.'),
            floorWeeks: sourced(2, 'Transcribed 12-week plan: two-week taper.'),
            droppable: sourced(false, 'All four mesocycles survive into the 12-week plan.'),
            volumeUnit: 'METRES',
            strengthKind: 'sharpen',
        },
    ],
    compressionOrder: sourced(
        ['endurance', 'lt', 'race-prep', 'taper'],
        'The 18→12 delta: Endurance −2, LT −2, Race Preparation −1, Taper −1.',
    ),
    dropOrder: sourced([], 'Nothing is droppable.'),
    schoolFloorWeeks: sourced(12, 'pfitzingercoaching.com/faq: "about 12-18 weeks"; the four floors sum to 12.'),
    peak: {
        kind: 'tiers',
        tiers: judged(
            [55, 70, 85, 100].map((mi) => mi * MILE),
            'Book tiers up to 55 / 55–70 / 70–85 / 85+ mi are sourced; 100 mi for 85+ is judged.',
        ),
    },
    ramp: {
        kind: 'linear',
        startFractionOfPeak: sourced(0.6, '18-week / 55 mi table opens at 33 mi, 0.60 of peak.'),
        maxStepFraction: judged(0.08, 'The table steps +2 to +4 mi a week, about 5–11 %.'),
    },
    cutbackCadence: sourced(4, '18-week table: recovery weeks at weeks-to-goal 12 and 8.'),
    cutbackDepth: judged(0.15, 'The table cuts back 10–18 % below the prior loading week.'),
    taperFractions: sourced([0.8, 0.58, 0.4], '18-week / 55 mi table: 43–45, 32, then 22 mi plus the race.'),
    leadIn: {
        split: sourced('100/0: general aerobic running only', 'Plans have no on-ramp; at least 24 km a week to start.'),
        touch: sourced('strides', 'General aerobic runs carry strides.'),
    },
    intensityLabels: [
        {
            key: 'REC',
            name: 'Recovery',
            edwardsWeight: judged(1),
            targetType: sourced('PACE'),
            paceDerivation: 'LT pace from the anchor; recovery is well slower.',
        },
        {
            key: 'GA',
            name: 'General aerobic',
            edwardsWeight: judged(2),
            targetType: sourced('PACE'),
            paceDerivation: 'LT pace from the anchor; general aerobic is well slower.',
        },
        {
            key: 'MP',
            name: 'Marathon pace',
            edwardsWeight: judged(3),
            targetType: sourced('PACE'),
            paceDerivation: 'LT pace from the anchor; marathon pace is "a couple of percent slower".',
        },
        {
            key: 'LT',
            name: 'Lactate threshold',
            edwardsWeight: judged(4),
            targetType: sourced('PACE', 'pfitzingercoaching.com: LT pace is the best predictor of race pace.'),
            paceDerivation: 'LT pace from the anchor: about the pace you could race for an hour.',
        },
        {
            key: 'VO2',
            name: 'VO2max',
            edwardsWeight: judged(5),
            targetType: sourced('PACE'),
            paceDerivation: 'LT pace from the anchor; VO2max is about 5K race pace.',
        },
    ],
    keySessions: [
        { key: 'long', name: 'Long run', reason: 'Pfitzinger calls the long run "number one".' },
        { key: 'lt', name: 'Lactate threshold', reason: 'The weekly LT session is the cornerstone workout.' },
        { key: 'medium-long', name: 'Medium-long run', reason: 'The second endurance run of the week.' },
        { key: 'vo2', name: 'VO2max or tune-up race', reason: 'Race Preparation is built around it.' },
    ],
    cutOrder: sourced(
        ['recovery', 'general-aerobic'],
        "Recovery runs, then general aerobic; never make up lost time. The medium-long run is shortened, not removed.",
    ),
    strengthTemplates: [
        { key: 'heavy-full-body', name: 'Heavy full body', tag: 'heavy' },
        { key: 'light-maintenance', name: 'Light maintenance', tag: 'light' },
    ],
};

export const SCHOOLS: readonly SchoolDefinition[] = [POLARIZED, DANIELS, PFITZINGER];

export function getSchool(id: SchoolId): SchoolDefinition {
    const school = SCHOOLS.find((s) => s.id === id);
    if (!school) throw new Error(`Unknown school: ${id}`);
    return school;
}

export function isSchoolId(value: unknown): value is SchoolId {
    return SCHOOLS.some((s) => s.id === value);
}
