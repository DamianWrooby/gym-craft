<script lang="ts">
    import TiltFrame from '$lib/components/tilt-frame/TiltFrame.svelte';
    import Play from '$lib/images/play.svg';

    export let src: string;
    export let tilt: 'left' | 'right' = 'right';

    let video: HTMLVideoElement;
    let isPlayButtonVisible = true;

    const onPlayClick = () => {
        if (video.paused || video.ended) {
            video.play();
            isPlayButtonVisible = false;
        } else {
            video.pause();
            isPlayButtonVisible = true;
        }
    };
</script>

<TiltFrame {tilt}>
    <!--
        object-cover, not the default contain: screen recordings captured on an ultrawide
        display carry the desktop background baked in as black bars beside the app window.
        Filling a 16:9 box crops those bars away instead of letterboxing the whole frame.
        For a recording that is already 16:9 this is a no-op, so every demo can share it.
    -->
    <video
        bind:this={video}
        class="rounded-lg w-full aspect-video object-cover"
        muted={false}
        preload="metadata"
        on:ended={() => (isPlayButtonVisible = true)}>
        <source {src} type="video/mp4" />
        Your browser does not support the video tag.
    </video>
    <button
        class="absolute top-0 w-full h-full flex justify-center items-center group"
        on:click={onPlayClick}
        aria-label="Play video">
        <img
            alt="play button"
            src={Play}
            class="w-24 h-24 cursor-pointer group-hover:drop-shadow-[0px_0px_10px_rgba(255,255,255,0.5)]"
            class:hidden={!isPlayButtonVisible} />
    </button>
</TiltFrame>
