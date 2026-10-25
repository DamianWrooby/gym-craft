<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    const currentYear = new Date().getFullYear();

    const links = [
        { href: '/', label: m.footer_home() },
        { href: '/privacy-policy', label: m.register_privacy_link() },
        { href: '/terms-of-use', label: m.register_terms_link() },
    ];
</script>

<div class="bg-primary-500 font-thin text-center py-2 font-semibold">
    <nav aria-label="Footer">
        <ul class="flex flex-wrap justify-center gap-x-4 gap-y-1 pb-1 text-sm">
            {#each links as link}
                <li>
                    <a href={link.href} class="text-surface-200 hover:text-surface-300 hover:underline">{link.label}</a>
                </li>
            {/each}
        </ul>
    </nav>
    <div class="hidden sm:block">
        © {currentYear} <span class="font-bold">GymCraft</span> - {m.footer_tagline()}
        <a href="https://github.com/DamianWrooby" target="_blank" rel="noopener noreferrer"
            ><span class="text-surface-200 hover:text-surface-300 font-semibold">Wrooby</span></a>
    </div>
    <div class="block sm:hidden">
        © {currentYear} <span class="font-bold">GymCraft</span>
    </div>
</div>
