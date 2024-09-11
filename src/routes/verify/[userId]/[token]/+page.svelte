<script lang="ts">
    import Card from '$lib/components/card/Card.svelte';
</script>

<Card>
    <div class="md:w-[75%] m-auto text-center">
        <p class="pb-5">Your account has been successfully verified. You can now log in.</p>
        <a href="/login" class="btn variant-filled-primary group">
            <span>Log in</span>
        </a>
    </div>
</Card>
