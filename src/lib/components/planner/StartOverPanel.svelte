<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    // Start a new plan (#435): the active plan is abandoned, not deleted, and the wizard opens.
    // It costs one plan revision, so the confirm step shows what is left this month.
    import { goto, invalidateAll } from '$app/navigation';
    import { abandonPlan } from '$lib/planner/adapt-client';

    export let userId: string;
    export let revisions: { used: number; cap: number } | null;

    let open = false;
    let busy = false;
    let error: string | null = null;
    $: left = revisions ? Math.max(0, revisions.cap - revisions.used) : null;

    async function confirm() {
        busy = true;
        error = null;
        const answer = await abandonPlan(userId);
        busy = false;
        if ('error' in answer) {
            error = answer.error;
            return;
        }
        await invalidateAll();
        await goto('/app/plan/setup');
    }
</script>

{#if open}
    <section class="gc-panel p-4 space-y-3" aria-label={m.abandon_aria()}>
        {#if left != null}<p class="text-sm text-slate-300">{m.abandon_intro({ left })}</p>{/if}
        <button type="button" class="gc-button" disabled={busy || left === 0} on:click={confirm}>
            {busy ? m.abandon_working() : m.abandon_confirm()}
        </button>
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => (open = false)}
            >{m.common_cancel()}</button>
        {#if error}<p class="text-sm text-rose-300" role="alert">{error}</p>{/if}
    </section>
{:else}
    <button type="button" class="gc-ghost" on:click={() => (open = true)}>{m.abandon_open()}</button>
{/if}
