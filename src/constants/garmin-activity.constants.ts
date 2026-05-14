export const GARMIN_ACTIVITY_TYPES = [
    { label: 'All', value: '' },
    { label: 'Running', value: 'running' },
    { label: 'Cycling', value: 'cycling' },
    { label: 'Swimming', value: 'swimming' },
    { label: 'Walking', value: 'walking' },
    { label: 'Hiking', value: 'hiking' },
    { label: 'Strength Training', value: 'strength_training' },
    { label: 'Cardio', value: 'cardio' },
    { label: 'Yoga', value: 'yoga' },
    { label: 'Elliptical', value: 'elliptical' },
    { label: 'Indoor Cycling', value: 'indoor_cycling' },
    { label: 'Treadmill Running', value: 'treadmill_running' },
] as const;

export type GarminActivityTypeValue = (typeof GARMIN_ACTIVITY_TYPES)[number]['value'];
