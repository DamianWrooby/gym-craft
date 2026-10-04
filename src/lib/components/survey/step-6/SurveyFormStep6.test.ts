import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import SurveyFormStep6 from './SurveyFormStep6.svelte';
import type { EquipmentModel } from '@/models/survey/survey-form.model';

const emptyEquipment = (): EquipmentModel => ({
    freeWeights: false,
    trainingMachines: false,
    treadmill: false,
    rowingMachine: false,
    stationaryBike: false,
    elliptical: false,
    stairMaster: false,
    resistanceBands: false,
    trx: false,
    calisthenics: false,
    mtbBike: false,
    roadBike: false,
});

describe('SurveyFormStep6', () => {
    afterEach(cleanup);

    it('selects every option, then clears them all', async () => {
        const data = emptyEquipment();
        render(SurveyFormStep6, { props: { data } });
        const selectAll = screen.getByLabelText('Select all');

        await fireEvent.click(selectAll);
        expect(Object.values(data).every(Boolean)).toBe(true);

        await fireEvent.click(selectAll);
        expect(Object.values(data).some(Boolean)).toBe(false);
    });

    it('marks select-all checked when every option is already selected', () => {
        const data = emptyEquipment();
        (Object.keys(data) as (keyof EquipmentModel)[]).forEach((key) => (data[key] = true));
        render(SurveyFormStep6, { props: { data } });
        expect(screen.getByLabelText('Select all')).toBeChecked();
    });
});
