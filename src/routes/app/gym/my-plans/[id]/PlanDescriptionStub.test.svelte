<script lang="ts">
    // Test stand-in for PlanDescription: one button that asks to send the first workout.
    import { createEventDispatcher } from 'svelte';
    import type { Plan } from '@models/plan/plan.model';

    export let plan: Plan;
    export let garminLoading: string | null = null;

    const dispatch = createEventDispatcher();
</script>

<button
    type="button"
    disabled={!!garminLoading}
    on:click={() => dispatch('sendToGarminClicked', { workout: plan.workouts[0] })}>Send to Garmin</button>
