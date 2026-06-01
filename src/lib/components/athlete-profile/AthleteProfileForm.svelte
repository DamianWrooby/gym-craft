<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { SEX_LABELS } from '@/constants/training-report.constants';
    import type { Sex } from '@prisma/client';

    export let profile: {
        birthDate: string;
        sex: Sex;
        weightKg: number;
        heightCm: number;
        timezone: string;
        restingHR: number | null;
        maxHR: number | null;
        vo2max: number | null;
    } | null = null;
    export let saving = false;

    const dispatch = createEventDispatcher<{
        save: {
            birthDate: string;
            sex: Sex;
            weightKg: number;
            heightCm: number;
            timezone: string;
            restingHR?: number | null;
            maxHR?: number | null;
            vo2max?: number | null;
        };
    }>();

    let birthDate = profile?.birthDate ?? '';
    let sex: Sex = profile?.sex ?? 'OTHER';
    let weightKg: number | null = profile?.weightKg ?? null;
    let heightCm: number | null = profile?.heightCm ?? null;
    let restingHR: number | null = profile?.restingHR ?? null;
    let maxHR: number | null = profile?.maxHR ?? null;
    let vo2max: number | null = profile?.vo2max ?? null;
    let formError = '';

    function onSubmit(e: Event) {
        e.preventDefault();
        if (!birthDate) return (formError = 'Birth date is required');
        if (weightKg == null || weightKg <= 0) return (formError = 'Weight is required');
        if (heightCm == null || heightCm <= 0) return (formError = 'Height is required');
        formError = '';
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        dispatch('save', {
            birthDate,
            sex,
            weightKg,
            heightCm,
            timezone: detectedTimezone,
            restingHR: restingHR ?? null,
            maxHR: maxHR ?? null,
            vo2max: vo2max ?? null,
        });
    }
</script>

<form class="space-y-4" on:submit={onSubmit}>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="label">
            <span>Birth date</span>
            <input type="date" class="input" bind:value={birthDate} required />
        </label>
        <label class="label">
            <span>Sex</span>
            <select class="select" bind:value={sex} required>
                {#each Object.entries(SEX_LABELS) as [key, label]}
                    <option value={key}>{label}</option>
                {/each}
            </select>
        </label>
        <label class="label">
            <span>Weight (kg)</span>
            <input type="number" class="input" step="0.1" min="20" max="300" bind:value={weightKg} required />
        </label>
        <label class="label">
            <span>Height (cm)</span>
            <input type="number" class="input" step="1" min="100" max="250" bind:value={heightCm} required />
        </label>
    </div>

    <details class="rounded border border-surface-300 dark:border-surface-700 p-3">
        <summary class="cursor-pointer font-semibold">Advanced (optional)</summary>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
            <label class="label">
                <span>Resting HR (bpm)</span>
                <input type="number" class="input" min="30" max="120" bind:value={restingHR} />
            </label>
            <label class="label">
                <span>Max HR (bpm)</span>
                <input type="number" class="input" min="100" max="250" bind:value={maxHR} />
            </label>
            <label class="label">
                <span>VO2 max</span>
                <input type="number" class="input" step="0.1" min="20" max="100" bind:value={vo2max} />
            </label>
        </div>
    </details>

    {#if formError}
        <p class="text-error-500">{formError}</p>
    {/if}
    <div class="flex justify-end">
        <button type="submit" class="btn variant-filled-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
        </button>
    </div>
</form>
