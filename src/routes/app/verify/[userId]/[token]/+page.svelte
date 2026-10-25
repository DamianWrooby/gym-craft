<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import Card from '$lib/components/card/Card.svelte';
</script>

<Card>
    <div class="md:w-3/4 m-auto text-center">
        <p class="pb-5">{m.verify_success()}</p>
        <div class="text-center">
            <a class="text-secondary-400 hover:text-secondary-300" href="/app">{m.common_home_page()}</a>
        </div>
    </div>
</Card>
