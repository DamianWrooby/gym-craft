<script>
    import { page } from '$app/stores';
    import Card from '$lib/components/card/Card.svelte';
</script>

<Card>
    <h1 class="h1 text-center text-5xl px-4">{$page.status}</h1>
    <p class="text-center text-primary-500 pb-8">{$page.error?.message}</p>
    <div class="text-center">
        <a class="text-secondary-400 hover:text-secondary-300" href="/app">Home Page</a>
    </div>
</Card>
