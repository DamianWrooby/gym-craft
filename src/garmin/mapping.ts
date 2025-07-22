import type { EndCondition } from "@/models/plan/plan.model";

export const sportTypes: Record<string, SportType> = {
    'running': {
        title: 'Running',
    },
    'cycling': {
        title: 'Cycling',
    },
    'other': {
		title: 'Other',
	},
    'swimming': {
        title: 'Swimming',
    },
    'strength_training': {
        title: 'Strength Training',
    },
    'cardio_training': {
        title: 'Cardio Training',
    },
    'yoga': {
        title: 'Yoga',
    },
    'pilates': {
        title: 'Pilates',
    },
    'hiit': {
        title: 'HIIT',
    },
};

export const stepTypes: Record<string, SportType> = {
    'warmup': {
        title: 'Warm Up',
    },
    'cooldown': {
        title: 'Cooldown',
    },
    'interval': {
        title: 'Interval',
    },
    'recovery': {
        title: 'Recovery',
    },
    'rest': {
        title: 'Rest',
    },
    'repeat': {
        title: 'Repeat',
    },
};

export const conditionTypeMapping: Record<string, EndCondition> = {
    calories: {
        conditionTypeId: 4,
        conditionTypeKey: 'calories',
        displayOrder: 4,
        displayable: true
    },
    distance: {
        conditionTypeId: 3,
        conditionTypeKey: 'distance',
        displayOrder: 3,
        displayable: true
    },
    'heart rate': {
        conditionTypeId: 6,
        conditionTypeKey: 'heart.rate',
        displayOrder: 6,
        displayable: true
    },
    'lap button': {
        conditionTypeId: 1,
        conditionTypeKey: 'lap.button',
        displayOrder: 1,
        displayable: true
    },
    iterations: {
        conditionTypeId: 7,
        conditionTypeKey: 'iterations',
        displayOrder: 7,
        displayable: false
    },
    power: {
        conditionTypeId: 5,
        conditionTypeKey: 'power',
        displayOrder: 5,
        displayable: true
    },
    time: {
        conditionTypeId: 2,
        conditionTypeKey: 'time',
        displayOrder: 2,
        displayable: true
    },
    'fixed rest': {
        conditionTypeId: 8,
        conditionTypeKey: 'fixed.rest',
        displayOrder: 8,
        displayable: true
    },
    'fixed repetition': {
        conditionTypeId: 9,
        conditionTypeKey: 'fixed.repetition',
        displayOrder: 9,
        displayable: true
    },
    reps: {
        conditionTypeId: 10,
        conditionTypeKey: 'reps',
        displayOrder: 10,
        displayable: true
    },
    'training peaks tss': {
        conditionTypeId: 11,
        conditionTypeKey: 'training.peaks.tss',
        displayOrder: 11,
        displayable: false
    },
    'repetition time': {
        conditionTypeId: 12,
        conditionTypeKey: 'repetition.time',
        displayOrder: 12,
        displayable: false
    },
    'time at valid cda': {
        conditionTypeId: 13,
        conditionTypeKey: 'time.at.valid.cda',
        displayOrder: 13,
        displayable: false
    },
    'power last lap': {
        conditionTypeId: 14,
        conditionTypeKey: 'power.last.lap',
        displayOrder: 14,
        displayable: false
    },
    'max power last lap': {
        conditionTypeId: 15,
        conditionTypeKey: 'max.power.last.lap',
        displayOrder: 15,
        displayable: false
    },
    'repetition swim css offset': {
        conditionTypeId: 16,
        conditionTypeKey: 'repetition.swim.css.offset',
        displayOrder: 16,
        displayable: true
    },
};

export const targetTypes = {
    'no.target': { label: 'No target' },
    'power.zone': { label: 'Power' },
    'cadence.zone': { label: 'Cadence' },
    'heart.rate.zone': {label: 'Heart rate'},
    'speed.zone': { label: 'Speed' },
    'pace.zone': { label: 'Pace' },
};

interface SportType {
    title: string,
};