import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GoalForm from './GoalForm.svelte';

afterEach(cleanup);

const today = '2026-10-24';

function renderForm(props: Record<string, unknown> = {}) {
    const save = vi.fn();
    const { component } = render(GoalForm, { today, ...props });
    component.$on('save', (e: CustomEvent) => save(e.detail));
    return save;
}

describe('GoalForm', () => {
    it('saves a half-marathon A race', async () => {
        const save = renderForm();
        await fireEvent.input(screen.getByLabelText('Race date'), { target: { value: '2027-04-11' } });
        await fireEvent.input(screen.getByLabelText('Target time (optional)'), { target: { value: '1:45:00' } });
        await fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));
        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({ goalType: 'RACE', targetDistanceM: 21097, targetTimeSec: 6300, priority: 1 }),
        );
    });

    it('blocks save with a reason while the race date is today', async () => {
        renderForm();
        await fireEvent.input(screen.getByLabelText('Race date'), { target: { value: today } });
        expect(screen.getByRole('button', { name: 'Save goal' })).toBeDisabled();
        expect(screen.getByText('The race date must be after today.')).toBeInTheDocument();
    });

    it('saves no race with null date, distance and time', async () => {
        const save = renderForm({ others: [{ goalType: 'RACE', priority: 1 }] });
        await fireEvent.click(screen.getByRole('button', { name: /No race/ }));
        await fireEvent.click(screen.getByRole('button', { name: 'Save goal' }));
        expect(save).toHaveBeenCalledWith(
            expect.objectContaining({
                goalType: 'BASE_BUILDING',
                targetEventDate: null,
                targetDistanceM: null,
                targetTimeSec: null,
                priority: 2,
            }),
        );
    });
});
