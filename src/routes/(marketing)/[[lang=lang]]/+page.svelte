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

    import Highlighted from '$lib/components/highlighted/Highlighted.svelte';
    import Hreflang from '$lib/components/seo/Hreflang.svelte';
    import { m } from '$lib/paraglide/messages.js';
    import {
        howItWorksItems as howItWorks,
        trainingComponentItems as trainingComponents,
        faqItems as faq,
    } from './content';
    import ManImage from '$lib/images/man-at-gym2.jpeg';
    import GymImage from '$lib/images/gym-31.jpeg';

    // Skeleton's AccordionItem only renders its panel while open, so the FAQ answers never
    // reach the prerendered HTML — only the questions do. This mirrors them into the head as
    // FAQPage structured data so the answers are at least machine-readable. Every `<` is
    // escaped to <: without it, an answer containing a closing script tag would end the
    // block early. For the same reason the tag below is written as <\/script>.
    const howItWorksItems = howItWorks();
    const trainingComponentItems = trainingComponents();
    const faqItems = faq();

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

<Seo title={m.mk_seo_title()} metaDescription={m.mk_seo_description()} />
<Hreflang />

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
                >{m.mk_hero_coach()}</span>
            {m.mk_hero_for()}
            <span
                class="bg-gradient-to-br from-blue-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone"
                >{m.mk_hero_data()}</span>
        </h1>
        <h2 class="h4">{m.mk_hero_sub()}</h2>
        <CtaButton url="/app" text={m.mk_cta_try()} />
    </div>
    <div class="z-10 w-full xl:w-1/2 p-5 xl:p-16 xl:pl-0">
        <DemoVideo src={GymCraftDemoVideo} tilt="right" />
    </div>
</section>
<section
    class="relative bg-surface-200 dark:bg-surface-800 text-surface-200 overflow-hidden w-full flex flex-col xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 pb-10 font-semibold">{m.mk_target_heading()}</h2>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_target_p1()} /></p>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_target_p2()} /></p>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_target_p3()} /></p>
        <div class="w-full py-10 flex">
            <img loading="lazy" alt={m.mk_img_garmin_alt()} src={ManImage} class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
            <img loading="lazy" alt={m.mk_img_gym_alt()} src={GymImage} class="w-1/2 pr-1 sm:pr-2 rounded-lg" />
        </div>
        <h3 class="h3 pt-10 pb-10 font-semibold">{m.mk_time_heading()}</h3>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_time_p1()} /></p>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_time_p2()} /></p>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_time_p3()} /></p>
        <h3 class="h3 pt-10 pb-10 font-semibold">{m.mk_who_heading()}</h3>
        <h4 class="h4 text-left font-semibold">{m.mk_who_beginners_title()}</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_who_beginners()} /></p>
        <h4 class="h4 text-left font-semibold">{m.mk_who_advanced_title()}</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_who_advanced()} /></p>
        <h4 class="h4 text-left font-semibold">{m.mk_who_runners_title()}</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_who_runners()} /></p>
        <h4 class="h4 text-left font-semibold">{m.mk_who_trainers_title()}</h4>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_who_trainers()} /></p>
    </div>
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center mx-auto">
        <h3 class="h2 uppercase font-bold pb-10">{m.mk_how_heading()}</h3>

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
            <CtaButton url="/app" text={m.mk_cta_first_plan()} />
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
        <h2 class="h2 font-bold mb-4 text-primary-700 dark:text-error-500">{m.mk_garmin_heading()}</h2>
        <p class="text-lg md:text-xl font-light mb-6">
            {m.mk_garmin_p_before()}
            <span class="text-secondary-500 dark:text-secondary-400">
                <a href="https://connect.garmin.com/" target="_blank" rel="noopener noreferrer">Garmin Connect™</a>
            </span>
            {m.mk_garmin_p_after()}
        </p>
        <ul class="list-disc list-inside text-left text-base md:text-lg font-light mb-8 mx-auto max-w-xl">
            <li>{m.mk_garmin_li1()}</li>
            <li>{m.mk_garmin_li2()}</li>
            <li>{m.mk_garmin_li3()}</li>
            <li>{m.mk_garmin_li4()}</li>
        </ul>
        <p class="text-error-800 dark:text-error-400 text-lg md:text-xl font-light mb-6">
            {m.mk_garmin_claim()}
        </p>
        <div class="flex justify-center">
            <CtaButton url="/app" text={m.mk_cta_garmin()} />
        </div>
    </div>
</section>
<!-- End Garmin Integration Section -->

<!-- Running Analytics Section -->
<section
    class="relative bg-surface-100 dark:bg-surface-900 text-surface-500 dark:text-surface-200 overflow-hidden w-full flex flex-col-reverse xl:flex-row justify-center">
    <div class="z-10 xl:w-1/2 px-5 py-24 xl:px-16 xl:py-36 text-center">
        <h2 class="h2 font-bold mb-4 text-primary-700 dark:text-error-500">{m.mk_running_heading()}</h2>
        <p class="text-lg md:text-xl font-light mb-6">
            {m.mk_running_p()}
        </p>
        <ul class="list-disc list-inside text-left text-base md:text-lg font-light mb-8 mx-auto max-w-xl">
            <li>{m.mk_running_li1()}</li>
            <li>{m.mk_running_li2()}</li>
            <li>{m.mk_running_li3()}</li>
            <li>{m.mk_running_li4()}</li>
            <li>{m.mk_running_li5()}</li>
        </ul>
        <p class="text-error-800 dark:text-error-400 text-lg md:text-xl font-light mb-6">
            {m.mk_running_claim()}
        </p>
        <div class="flex justify-center">
            <CtaButton url="/app" text={m.mk_cta_load()} />
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
        <h2 class="h2 pb-10 font-semibold">{m.mk_keep_heading()}</h2>
        <h3 class="h3 pt-10 pb-10 text-center font-semibold">{m.mk_keep_sub()}</h3>
        <p class="text-left font-light text-lg md:text-xl pb-5"><Highlighted text={m.mk_keep_p()} /></p>
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
        <h2 class="h2 pb-10 font-semibold">{m.mk_faq_heading()}</h2>
        <FaqAccordion items={faqItems} />
        <div class="pt-16">
            <CtaButton url="/app" text={m.mk_cta_start()} />
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
