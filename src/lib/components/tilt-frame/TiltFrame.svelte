<script lang="ts">
    // Which way the frame tilts on wide screens. Sections alternate down the marketing
    // page, so the tilt leans away from the copy sitting beside it. Below xl the tilt
    // is dropped entirely — the media is full width there and rotating it just wastes space.
    export let tilt: 'left' | 'right' = 'right';
</script>

<div class="relative" class:perspective-left={tilt === 'left'} class:perspective-right={tilt === 'right'}>
    <slot />
</div>

<style>
    @media (min-width: 1280px) {
        .perspective-right {
            transform: perspective(1600px) rotateY(-31deg);
            transition: transform 1s ease 0s;
        }
        .perspective-right:hover {
            transform: unset;
            transition: transform 1s ease 0s;
        }
        .perspective-left {
            transform: perspective(1600px) rotateY(31deg);
            transition: transform 1s ease 0s;
        }
        .perspective-left:hover {
            transform: unset;
            transition: transform 1s ease 0s;
        }
    }
</style>
