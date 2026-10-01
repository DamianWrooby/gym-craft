<script lang="ts">
    const currentYear = new Date().getFullYear();

    const links = [
        { href: '/', label: 'Home' },
        { href: '/privacy-policy', label: 'Privacy Policy' },
        { href: '/terms-of-use', label: 'Terms of Use' },
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
        © {currentYear} <span class="font-bold">GymCraft</span> - Your AI powered personal trainer by
        <a href="https://github.com/DamianWrooby" target="_blank" rel="noopener noreferrer"
            ><span class="text-surface-200 hover:text-surface-300 font-semibold">Wrooby</span></a>
    </div>
    <div class="block sm:hidden">
        © {currentYear} <span class="font-bold">GymCraft</span>
    </div>
</div>
