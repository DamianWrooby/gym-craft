import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConflictFacts, ConflictRecord } from '$lib/planner/core/conflict';

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn(async () => undefined) }));
const client = vi.hoisted(() => ({ answerDecision: vi.fn(async () => ({ ok: true })) }));
vi.mock('$lib/planner/generation-client', () => client);

import ConflictNote from './ConflictNote.svelte';

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const facts = (overrides: Partial<ConflictFacts> = {}): ConflictFacts => ({
    plannedTotal: 418,
    budget: 390,
    overspend: 28,
    stillOver: 0,
    removed: [{ title: 'Foundation run', plannedLoad: 40, cutKey: 'foundation' }],
    offered: null,
    cutOrder: ['recovery', 'foundation'],
    protected: ['Hard', 'Long run'],
    fallbackShare: 0,
    ...overrides,
});

function renderNote(conflict: ConflictRecord, decision: 'PENDING' | 'DROPPED' | null = null, keptWeeks = 0) {
    return render(ConflictNote, {
        week: { id: 'week-1', conflict, decision },
        schoolName: 'Polarized 80/20',
        userId: 'user-1',
        keptWeeks,
    });
}

const ask = (schoolFit = false): ConflictRecord => ({
    placement: null,
    budget: {
        kind: 'ASK',
        schoolFit,
        removed: [],
        keySession: { scheduledDate: '2026-10-14', sequence: 0 },
        facts: facts({
            removed: [],
            plannedTotal: 330,
            budget: 300,
            overspend: 30,
            offered: { title: 'Hard', plannedLoad: 118, options: ['DROP', 'DOWNGRADE', 'KEEP'] },
        }),
    },
});

describe('ConflictNote', () => {
    it('states a silent trim in one line', () => {
        renderNote({ placement: null, budget: { kind: 'TRIM', facts: facts() } });
        expect(screen.getByText(/Trimmed Foundation run/)).toHaveTextContent('to fit the recovery budget');
    });

    it('offers each option of a budget ask and sends the answer', async () => {
        renderNote(ask(), 'PENDING');
        expect(screen.getByRole('alert')).toHaveTextContent('30 TRIMP over budget');
        await fireEvent.click(screen.getByRole('button', { name: 'Downgrade Hard one intensity step' }));
        expect(client.answerDecision).toHaveBeenCalledWith('user-1', 'week-1', 'DOWNGRADE');
        expect(screen.getByRole('button', { name: 'Drop Hard' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Keep the week/ })).toBeInTheDocument();
    });

    it('shows the school-fit warning with the kept weeks and a link to change school', async () => {
        const { component } = renderNote(ask(true), 'PENDING', 3);
        const recut = vi.fn();
        component.$on('recut', recut);
        expect(screen.getByRole('note')).toHaveTextContent('Weeks you kept over budget so far: 3.');
        await fireEvent.click(screen.getByRole('button', { name: 'Change school' }));
        expect(recut).toHaveBeenCalled();
    });

    describe('a placement ask (story 60)', () => {
        const placement = (options: ('DROP' | 'REWRITE')[] = ['DROP', 'REWRITE']): ConflictRecord => ({
            placement: {
                removed: [],
                violations: ['Two key sessions fall on consecutive days'],
                cutOrder: ['foundation'],
                protected: ['Hard'],
                asked: { title: 'Long run', plannedLoad: 90, keySession: 'long', options },
            },
            budget: null,
        });

        it('asks to drop the key session or rewrite the week', async () => {
            renderNote(placement(), 'PENDING');
            expect(screen.getByRole('alert')).toHaveTextContent('Two key sessions fall on consecutive days');
            await fireEvent.click(screen.getByRole('button', { name: 'Rewrite the week' }));
            expect(client.answerDecision).toHaveBeenCalledWith('user-1', 'week-1', 'REWRITE');
        });

        it('offers only a drop when no retry is left', () => {
            renderNote(placement(['DROP']), 'PENDING');
            expect(screen.queryByRole('button', { name: 'Rewrite the week' })).not.toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Drop Long run' })).toBeInTheDocument();
        });

        it('records the drop once answered', () => {
            renderNote(placement(), 'DROPPED');
            expect(screen.getByText('You dropped Long run so the week fits your training days.')).toBeInTheDocument();
        });
    });
});
