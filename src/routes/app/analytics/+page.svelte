<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import Seo from '$lib/components/seo/Seo.svelte';
    import Card from '@components/card/Card.svelte';
</script>

<Seo title={`${m.running_analytics()} | GymCraft™`} metaDescription="Training analytics and insights." />

<Card width="3/4">
    <div class="md:w-3/4 m-auto pb-8">
        <p class="h3 font-bold mb-4 text-primary-700 dark:text-error-500 text-center">{m.analytics_like_app()}</p>
        <div class="text-center">
            <iframe
                title="Buy Me a Coffee"
                src="/bmc-widget.html"
                width="250"
                height="80"
                scrolling="no"
                style="border: none; margin: auto; display: block;"
                loading="lazy"></iframe>
        </div>
    </div>
</Card>
