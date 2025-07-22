<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import { CalendarIcon, HelpCircleIcon, ChevronsRightIcon } from 'svelte-feather-icons';
    import { sportTypes, stepTypes, targetTypes } from '@/garmin/mapping';
    import { periodizationText } from '@/constants/texts.constants';
    import {
        getEndConditionValue,
        generateEndConditionDescription,
        generateTargetDescription,
        generateExerciseName,
    } from '../../utils/plan-description';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import type { Plan, GeneratedWorkout, WorkoutStep } from '@models/plan/plan.model';
    import Spinner from '../loading/spinner/Spinner.svelte';

    export let plan: Plan;
    export let garminLoading: string | null;

    const dispatch = createEventDispatcher<{ sendToGarminClicked: { workout: GeneratedWorkout } }>();

    const popupHover: PopupSettings = {
        event: 'hover',
        target: 'popupHover',
        placement: 'bottom',
    };
</script>

<h1 class="h1 text-3xl font-bold py-2 text-center">{plan.name}</h1>
<h2 class="h2 text-2xl font-bold py-2">Weekly Training Plan Overview</h2>
<p>{plan.description}</p>
<br />
<br />
<h2 class="h2 text-2xl font-bold py-4 text-center">Training Schedule</h2>
<section class="text-surface-50">
    <Accordion hover="hover:bg-surface-700 rounded-md">
        {#each plan.workouts as workout}
            <AccordionItem rounded="false" class="bg-surface-900 rounded rounded-md border border-surface-400">
                <svelte:fragment slot="lead">
                    <CalendarIcon />
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex justify-between items-center">
                        <div>
                            <h3 class="h4 font-bold pt-2">
                                <span class="uppercase">{workout.dayOfWeek}</span> - {workout.workoutName}
                                <span class="h4 font-light text-surface-300"
                                    >| {sportTypes[workout.sportType.sportTypeKey].title}</span>
                            </h3>
                            <p class="pb-2 text-secondary-400 overflow-hidden text-ellipsis">{workout.justification}</p>
                        </div>
                        <div>
                            <button
                                class="btn btn-sm variant-ghost-primary group"
                                on:click|stopPropagation={() => dispatch('sendToGarminClicked', { workout })}
                                disabled={!!garminLoading}>
                                {#if garminLoading === workout.dayOfWeek}
                                    <Spinner size={4} />
                                {:else}
                                    <ChevronsRightIcon class="group-hover:animate-pulse" />
                                {/if}
                                <span>Send to Garmin</span>
                            </button>
                        </div>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
                    {#each workout.workoutSegments as segment}
                        {#each segment.workoutSteps as step, stepIndex}
                            {#if step.stepType.stepTypeKey === 'repeat'}
                                <h5 class="h5 font-bold pt-2">
                                    {stepIndex + 1}. Repeat block - {getEndConditionValue(step)} iterations
                                </h5>
                                <div class="p-2 rounded border border-surface-400">
                                    {#if step.workoutSteps?.length}
                                        {#each step.workoutSteps as subStep}
                                            <div class="text-tertiary-400">
                                                <h5 class="h5 font-bold py-2">
                                                    {stepTypes[subStep.stepType.stepTypeKey].title}
                                                </h5>
                                                <p>{subStep.description || ''}</p>
                                                {@html generateEndConditionDescription(subStep)}
                                                {@html generateTargetDescription(subStep)}
                                            </div>
                                        {/each}
                                    {/if}
                                </div>
                                <br />
                            {:else}
                                <h3 class="h5 font-bold py-2">
                                    {stepIndex + 1}. {stepTypes[step.stepType.stepTypeKey].title}
                                </h3>
                                {@html generateExerciseName(step)}
                                <p>
                                    {step.description || ''}
                                </p>
                                {@html generateEndConditionDescription(step)}
                                {@html generateTargetDescription(step)}
                                <br />
                            {/if}
                        {/each}
                    {/each}
                </svelte:fragment>
            </AccordionItem>
        {/each}
    </Accordion>
</section>
<div class="flex items-center pt-7 w-fit hover:cursor-help">
    <h2 class="h5 font-bold pr-2 hover:cursor-help" use:popup={popupHover}>Periodization and Progression</h2>
    <HelpCircleIcon size={'15'} />
</div>
<div class="card p-4 variant-filled-secondary" data-popup="popupHover">
    <p>{periodizationText}</p>
    <div class="arrow variant-filled-secondary" />
</div>
