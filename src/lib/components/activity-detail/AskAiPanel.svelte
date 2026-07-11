<script lang="ts">
    import { page } from '$app/stores';
    import { SendIcon, ZapIcon } from 'svelte-feather-icons';
    import Markdown from '$lib/components/markdown/Markdown.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import { EXPLAIN_QUESTION_MAX_LENGTH } from '@/constants/training-report.constants';
    import { billingEnabled } from '$lib/utils/billing-flag';

    export let userId: string;
    export let activityDbId: string;

    const PRESETS = [
        'Why did I fade?',
        'Was my pacing good?',
        'Was this productive?',
        'How does this compare to my recent runs?',
    ];

    let question = '';
    let loading = false;
    let analysis: string | null = null;
    let error: string | null = null;
    let showUpgradeHint = false;

    async function ask(text: string) {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (trimmed.length > EXPLAIN_QUESTION_MAX_LENGTH) {
            error = `Question must be ${EXPLAIN_QUESTION_MAX_LENGTH} characters or fewer.`;
            return;
        }

        loading = true;
        error = null;
        analysis = null;
        showUpgradeHint = false;

        try {
            const res = await fetch(`/api/user/${userId}/activities/${activityDbId}/explain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: trimmed }),
            });
            const payload = await res.json();
            if (!res.ok) {
                error = payload?.message ?? 'Failed to generate explanation.';
                showUpgradeHint =
                    billingEnabled &&
                    payload?.code === 'EXPLAIN_LIMIT_REACHED' &&
                    $page.data.user?.subscriptionTier === 'FREE';
            } else {
                analysis = payload?.data?.analysis ?? null;
                question = trimmed;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : 'Request failed.';
        } finally {
            loading = false;
        }
    }
</script>

<section class="card variant-soft-primary p-5">
    <header class="flex items-center gap-2 mb-3">
        <ZapIcon size="20" />
        <h2 class="h3 font-semibold m-0">Ask the coach about this run</h2>
    </header>

    <div class="flex flex-wrap gap-2 mb-3">
        {#each PRESETS as preset}
            <button
                type="button"
                class="chip variant-soft-surface hover:variant-filled-primary transition-colors"
                disabled={loading}
                on:click={() => ask(preset)}>
                {preset}
            </button>
        {/each}
    </div>

    <form class="flex flex-col sm:flex-row gap-2" on:submit|preventDefault={() => ask(question)}>
        <input
            type="text"
            class="input flex-1"
            placeholder="Ask anything about this run..."
            maxlength={EXPLAIN_QUESTION_MAX_LENGTH}
            bind:value={question}
            disabled={loading} />
        <button type="submit" class="btn variant-filled-primary" disabled={loading || !question.trim()}>
            <SendIcon size="16" />
            <span>Ask</span>
        </button>
    </form>

    {#if loading}
        <div class="mt-4 flex justify-center">
            <Spinner size={8} />
        </div>
    {/if}

    {#if error}
        <p class="text-error-500 text-sm mt-3">{error}</p>
        {#if showUpgradeHint}
            <a href="/app/my-account" class="anchor text-sm"> Upgrade to Supporter for 5 explanations per day → </a>
        {/if}
    {/if}

    {#if analysis}
        <div
            class="mt-4 rounded-xl border border-surface-300 dark:border-surface-700 p-4 bg-surface-100 dark:bg-surface-800">
            <Markdown source={analysis} />
        </div>
    {/if}
</section>
