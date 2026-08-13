<script lang="ts">
    import HowItWorksItem from '$lib/components/how-it-works-item/HowItWorksItem.svelte';
    import TrainingComponentItem from '$lib/components/training-component-item/TrainingComponentItem.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import CtaButton from '$lib/components/cta-button/CtaButton.svelte';
    import FaqAccordion from '$lib/components/faq-accordion/FaqAccordion.svelte';
    import DemoVideo from '$lib/components/demo-video/DemoVideo.svelte';
    import RunningDemoVideo from '$lib/videos/GymCraft-running-demo.mp4';
    import GymCraftDemoVideo from '$lib/videos/GymCraft-demo.mp4';
    import GarminDemoVideo from '$lib/videos/Garmin-demo.mp4';

    import { howItWorksItems, trainingComponentItems, faqItems } from './content';
    import ManImage from '$lib/images/man-at-gym2.jpeg';
    import GymImage from '$lib/images/gym-31.jpeg';

    // Skeleton's AccordionItem only renders its panel while open, so the FAQ answers never
    // reach the prerendered HTML — only the questions do. This mirrors them into the head as
    // FAQPage structured data so the answers are at least machine-readable. Every `<` is
    // escaped to <: without it, an answer containing a closing script tag would end the
    // block early. For the same reason the tag below is written as <\/script>.
    const faqJsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.title,
            acceptedAnswer: { '@type': 'Answer', text: item.content },
        })),
    }).replace(/</g, '\\u003c');
</script>

<svelte:head>
    <!-- eslint-disable-next-line svelte/no-at-html-tags, no-useless-escape -- built at build time from static copy in ./content with every `<` escaped, so nothing untrusted can be injected; the `\/` stops the HTML tokenizer ending the enclosing script block here -->
    {@html `<script type="application/ld+json">${faqJsonLd}<\/script>`}
</svelte:head>

<Seo
    title="GymCraft™ — AI workout plans &amp; Garmin running analytics"
    metaDescription="AI-generated workout plans synced to your Garmin, plus training-load analytics and weekly AI reports for every run you record. Free to start." />

<section class="relative py-24 overflow-hidden w-full flex flex-col xl:flex-row items-center justify-center">
    <div class="z-10 w-full xl:w-1/2 p-5 xl:p-16 text-center">
        <!--
            The H1 deliberately names the product category rather than today's two features:
            GymCraft is growing into a set of AI tools for athletes, and "AI coach" covers a
            third tool without a rewrite. It is also a real search term, unlike an abstract
            umbrella such as "AI tools for athletes", so the H2 below is where the specific
            keywords — workout plans, Garmin, training load — earn their place.
        -->
        <h1 class="h1 font-bold mb-5">
            <span
                class="bg-gradient-to-br from-primary-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone"
                >Your AI coach</span>
            for smarter,
            <span
                class="bg-gradient-to-br from-blue-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone"
                >data-driven training</span>
        </h1>
        <h2 class="h4">
            GymCraft builds your workout plans, syncs them to your Garmin, and turns every session you record into
            training-load analytics and coach-style weekly reports
        </h2>
        <CtaButton url="/app" text="Try it for FREE" />
    </div>
    <div class="z-10 w-full xl:w-1/2 p-5 xl:p-16 xl:pl-0">
        <DemoVideo src={GymCraftDemoVideo} tilt="right" />
    </div>
</section>
<section
    class="relative bg-surface-200 dark:bg-surface-800 text-surface-200 overflow-hidden w-full flex flex-col xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 pb-10 font-semibold">The fastest way to target your training and get the results you want</h2>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Training plans are built around <span class="text-secondary-400"
                >individual fitness levels, goals, and body types,</span> so every exercise contributes directly to achieving
            specific results. This tailored approach maximizes efficiency and effectiveness.
        </p>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            Whether the goal is <span class="text-secondary-400">weight loss, muscle gain, endurance, or recovery</span
            >, a custom plan adjusts exercises, intensity, and progression rates according to the user’s unique goals,
            allowing for steady progress.
        </p>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            The plan is only half the picture. GymCraft also reads the sessions you actually record, turns them into
            <span class="text-secondary-400">training load</span>, and tells you whether the work is adding up the way
            you intended — so you can adjust from
            <span class="text-secondary-400">evidence rather than guesswork</span>.
        </p>
        <div class="w-full py-10 flex">
            <img
                loading="lazy"
                alt="AI fitness app connected to Garmin"
                src={ManImage}
                class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
            <img
                loading="lazy"
                alt="AI personal coach - generate workout plan and send to Garmin with one click"
                src={GymImage}
                class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
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
        <h4 class="h4 text-left font-semibold">Runners who want to know if it's working</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5">
            You already record every session. GymCraft turns that history into <span class="text-secondary-400"
                >training load</span
            >, tells you whether you're building or
            <span class="text-secondary-400">heading for trouble</span>, and reviews your week the way a coach would —
            using your own data rather than a generic template.
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

<!-- New Garmin Integration Section -->
<section
    class="relative text-surface-500 dark:text-surface-200 overflow-hidden w-full flex flex-col xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <DemoVideo src={GarminDemoVideo} tilt="left" />
    </div>
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 font-bold mb-4 text-primary-700 dark:text-error-500">Seamless Garmin Integration</h2>
        <p class="text-lg md:text-xl font-light mb-6">
            Effortlessly sync your AI-generated workout plans with your
            <span class="text-secondary-500 dark:text-secondary-400">
                <a href="https://connect.garmin.com/" target="_blank" rel="noopener noreferrer">Garmin Connect™</a>
            </span>
            account. With just a click, send your personalized routines directly to your Garmin device and stay on track wherever
            you train.
        </p>
        <ul class="list-disc list-inside text-left text-base md:text-lg font-light mb-8 mx-auto max-w-xl">
            <li>Connect your Garmin account securely</li>
            <li>Export training plans in one step</li>
            <li>Access workouts on your Garmin watch or app</li>
            <li>Track progress and adapt plans in real time</li>
        </ul>
        <p class="text-error-800 dark:text-error-400 text-lg md:text-xl font-light mb-6">
            Check out the first AI powered fitness workout plan generator with direct Garmin integration.
        </p>
        <div class="flex justify-center">
            <CtaButton url="/app" text="Connect Garmin & Try Now" />
        </div>
    </div>
</section>
<!-- End Garmin Integration Section -->

<!-- Running Analytics Section -->
<section
    class="relative bg-surface-100 dark:bg-surface-900 text-surface-500 dark:text-surface-200 overflow-hidden w-full flex flex-col-reverse xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 font-bold mb-4 text-primary-700 dark:text-error-500">Running Analytics</h2>
        <p class="text-lg md:text-xl font-light mb-6">
            Sync your Garmin activities and get a full picture of your training. GymCraft turns every session you record
            into a training load, compares your last 7 days against your last 28, and tells you whether you're building
            fitness or digging a hole.
        </p>
        <ul class="list-disc list-inside text-left text-base md:text-lg font-light mb-8 mx-auto max-w-xl">
            <li>Training load, ACWR and monotony, with a plain-English status</li>
            <li>Every sport counts toward load — runs, rides, swims and hikes</li>
            <li>7-day distance broken out per sport, never mixed together</li>
            <li>Coach-style weekly AI reports with recommended adjustments</li>
            <li>Ask AI about any single run, split by split</li>
        </ul>
        <p class="text-error-800 dark:text-error-400 text-lg md:text-xl font-light mb-6">
            Stop guessing whether you're overdoing it — read it off the numbers your watch already collected.
        </p>
        <div class="flex justify-center">
            <CtaButton url="/app" text="See your training load" />
        </div>
    </div>
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <DemoVideo src={RunningDemoVideo} tilt="right" />
    </div>
</section>
<!-- End Running Analytics Section -->

<hr class="border !border-primary-900" />
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
    .bg-img {
        background-image:
            linear-gradient(150deg, rgba(212, 22, 60, 1) 30%, rgba(5, 5, 5, 0.7) 55%), url('/src/lib/images/gym-2.webp');
        background-size: cover;
        background-position: center;
        background-blend-mode: multiply;
        background-repeat: no-repeat;
        filter: brightness(0.2) hue-rotate(0deg) grayscale(0);
    }

    @media (min-width: 1280px) {
        .bg-img {
            background-attachment: fixed;
        }
    }
</style>
