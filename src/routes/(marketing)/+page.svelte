<script lang="ts">
    import HowItWorksItem from '$lib/components/how-it-works-item/HowItWorksItem.svelte';
    import TrainingComponentItem from '$lib/components/training-component-item/TrainingComponentItem.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import CtaButton from '$lib/components/cta-button/CtaButton.svelte';
    import FaqAccordion from '$lib/components/faq-accordion/FaqAccordion.svelte';
    import DemoVideo from '$lib/videos/GymCraft-demo.mp4';

    import { howItWorksItems, trainingComponentItems, faqItems } from './content';
    import Play from '$lib/images/play.svg';
    import ManImage from '$lib/images/man-at-gym2.jpeg';
    import GymImage from '$lib/images/gym-31.jpeg';

    let video: HTMLVideoElement;
    let isPlayButtonVisible = true;

    const onPlayClick = () => {
        video.paused || video.ended ? playVideo() : pauseVideo();
    };

    const playVideo = () => {
        video.play();
        isPlayButtonVisible = false;
    };

    const pauseVideo = () => {
        video.pause();
        isPlayButtonVisible = true;
    };
</script>

<Seo title="Personalized fitness plan in minutes | GymCraft™"
    metaDescription="Get a personalized fitness plan in minutes! Our AI-powered app analyzes your goals, abilities, and limitations to create a training plan tailored just for you." />

<section class="relative py-24 overflow-hidden w-full flex flex-col xl:flex-row items-center justify-center">
    <div class="z-10 xl:w-1/2 p-5 xl:p-16 text-center">
        <h1 class="h1 font-bold mb-5">
            Create a <span
                class="bg-gradient-to-br from-primary-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone"
                >training plan</span>
            tailored to
            <span
                class="bg-gradient-to-br from-blue-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone"
                >your needs</span>
        </h1>
        <h2 class="h4">
            GymCraft is an advanced AI tool thanks to which you will quickly create a training plan based on your goals,
            abilities and limitations
        </h2>
        <CtaButton url="/app" text="Try it for FREE" />
    </div>
    <div class="z-10 xl:w-1/2 p-5 xl:p-16 xl:pl-0">
        <div class="relative perspective">
            <video
                bind:this={video}
                class="rounded-lg"
                muted={false}
                preload="metadata"
                width="100%"
                on:ended={() => (isPlayButtonVisible = true)}>
                <source src={DemoVideo} type="video/mp4" />
                Your browser does not support the video tag.
            </video>
            <button
                class="absolute top-0 w-full h-full flex justify-center items-center group"
                on:click={() => onPlayClick()}
                aria-label="Play video">
                <img
                    alt="play button"
                    src={Play}
                    class="w-24 h-24 cursor-pointer group-hover:drop-shadow-[0px_0px_10px_rgba(255,255,255,0.5)]"
                    class:hidden={!isPlayButtonVisible} />
            </button>
        </div>
    </div>
</section>
<section
    class="relative bg-surface-200 dark:bg-surface-800 text-surface-200 overflow-hidden w-full flex flex-col xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 pb-10 font-semibold">The fastest way to target your training and get the results you want</h2>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Personalized training plans are designed based on <span class="text-secondary-400"
                >individual fitness levels, goals, and body types,</span> ensuring that every exercise contributes directly
            to achieving specific results. This tailored approach maximizes efficiency and effectiveness.
        </p>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Whether the goal is <span class="text-secondary-400">weight loss, muscle gain, endurance, or recovery</span
            >, a custom plan adjusts exercises, intensity, and progression rates according to the user’s unique goals,
            allowing for steady progress.
        </p>
        <div class="w-full py-10 flex">
            <img alt="Man at the hi-tec gym" src={ManImage} class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
            <img alt="Technologically advanced gym" src={GymImage} class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
        </div>
        <h3 class="h3 pt-10 pb-10 font-semibold">Time is priceless</h3>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            With a personalized plan, every workout session is designed to make the most of the time available. Don't
            waste time on <span class="text-secondary-400">unnecessary exercises</span> or
            <span class="text-secondary-400">aimless routines</span>.
        </p>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            By following a plan specifically crafted to your needs, you can reach your goals more quickly, reducing time
            spent on ineffective or irrelevant exercises.
        </p>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Tailored plans can accommodate <span class="text-secondary-400">busy lifestyles</span>, allowing for
            <span class="text-secondary-400">flexibility</span> in workout duration and frequency to fit the user's schedule.
        </p>
        <h3 class="h3 pt-10 pb-10 font-semibold">Who is this app for?</h3>
        <h4 class="h4 text-left font-semibold">Beginners starting their fitness journey</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            If you're new to working out and don’t have a specific training plan yet, our app is the perfect <span
                class="text-secondary-400">starting point</span
            >. It helps guide you through effective, goal-oriented workouts tailored to your fitness level, allowing you
            to build a <span class="text-secondary-400">strong foundation</span> and stay motivated with a clear path forward.
        </p>
        <h4 class="h4 text-left font-semibold">Advanced sport enthusiasts seeking new challenges</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            For those with more experience, our app serves as a valuable <span class="text-secondary-400"
                >source of inspiration</span
            >. It provides fresh workout ideas and exercises you might not have considered, helping you break through
            plateaus, <span class="text-secondary-400">diversify your training</span>, and push your limits further.
        </p>
        <h4 class="h4 text-left font-semibold">Personal trainers in need of a head start</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Personal trainers can use the app to quickly generate a base training plan skeleton for their clients. The
            app saves time by providing a <span class="text-secondary-400">well-structured starting point</span>, which
            trainers can further customize and expand, or use it to
            <span class="text-secondary-400">discover new exercises and programming ideas</span> that enhance their clients'
            routines.
        </p>
    </div>
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center mx-auto">
        <h3 class="h2 uppercase font-bold pb-10">How it works?</h3>

        {#each howItWorksItems as item, index (item)}
            <HowItWorksItem
                verticalLabel={item.verticalLabel}
                numbering={index + 1}
                title={item.title}
                description={item.description}
                isEven={index % 2 === 0}
                icon={item.icon}
                isLast={index === howItWorksItems.length - 1} />
        {/each}
        <div class="pt-16">
            <CtaButton url="/app" text="Create your first plan" />
        </div>
    </div>
    <div class="bg-img absolute w-full h-full"></div>
</section>
<section class="relative overflow-hidden w-full pt-10 flex flex-col xl:flex-row items-center justify-center">
    <div class="z-10 max-w-5xl p-5 xl:p-16 text-center">
        <h2 class="h2 pb-10 font-semibold">What should you keep in mind?</h2>
        <h3 class="h3 pt-10 pb-10 text-center font-semibold">The training plan is just one component</h3>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            To get the desired training results, in addition to the right training plan, there are several important
            elements to keep in mind:
        </p>
        <div class="flex flex-wrap gap-4">
            {#each trainingComponentItems as item (item)}
                <TrainingComponentItem title={item.title} description={item.description} icon={item.icon} />
            {/each}
        </div>
    </div>
</section>
<hr class="border !border-primary-900" />
<section class="relative overflow-hidden w-full py-10 flex flex-col xl:flex-row items-center justify-center">
    <div class="z-10 p-5 w-full xl:p-16 text-center">
        <h2 class="h2 pb-10 font-semibold">FAQ</h2>
        <FaqAccordion items={faqItems} />
        <div class="pt-16">
            <CtaButton url="/app" text="Start using GymCraft" />
        </div>
    </div>
</section>

<style>
    @media (min-width: 1280px) {
        .perspective {
            transform: perspective(1000px) rotateY(-31deg);
            transition: transform 1s ease 0s;
        }
        .perspective:hover {
            transform: unset;
            transition: transform 1s ease 0s;
        }
    }

    .bg-img {
        background-image: linear-gradient(150deg, rgba(212, 22, 60, 1) 30%, rgba(5, 5, 5, 0.7) 55%),
            url('/src/lib/images/gym-2.webp');
        background-size: cover;
        background-position: center;
        background-blend-mode: multiply;
        background-repeat: no-repeat;
        background-attachment: fixed;
        filter: brightness(0.2) hue-rotate(0deg) grayscale(0);
    }
</style>
