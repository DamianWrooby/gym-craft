<script lang="ts">
    import { onMount } from 'svelte';
    import { DownloadIcon } from 'svelte-feather-icons';
    import { generateFullPlanDescription } from '../../utils/plan-description';
    import type { Plan } from '@models/plan/plan.model';

    export let plan: Plan;
    // @ts-expect-error html2pdf.js is not typed
    let html2pdf;

    onMount(async () => {
        // @ts-expect-error html2pdf.js is not typed
        const module = await import('html2pdf.js');
        html2pdf = module.default;
    });

    function print() {
        const htmlString = generateFullPlanDescription(plan);
        const htmlElementCopy = htmlStringToElement(htmlString);

        const opt = {
            margin: [20, 20],
            filename: `${plan.name}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };

        htmlElementCopy.style.color = 'black';

        // @ts-expect-error html2pdf.js is not typed
        html2pdf().set(opt).from(htmlElementCopy).save();
    }

    function htmlStringToElement(html: string): HTMLElement {
        const container = document.createElement('div');
        container.innerHTML = html;

        return container;
    }
</script>

<button class="btn btn-sm variant-filled-secondary group" on:click={() => print()}>
    <DownloadIcon class="group-hover:animate-pulse" />
    <span>Download as PDF</span>
</button>
