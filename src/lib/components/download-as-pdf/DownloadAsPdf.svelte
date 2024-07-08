<script lang="ts">
    import { onMount } from 'svelte'
    import { DownloadIcon } from 'svelte-feather-icons';

    export let htmlElement: HTMLElement;
    export let fileName: string;
    // @ts-ignore
    let html2pdf;

    onMount(async () => {
        // @ts-ignore
        const module = await import('html2pdf.js');
        html2pdf = module.default;
    });

    function print() {
        const opt = {
            margin: [15, 15],
            filename: `${fileName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };
        
        const htmlElementCopy = htmlElement.cloneNode(true) as HTMLElement;
        htmlElementCopy.style.color = 'black';
        // @ts-ignore
        html2pdf().set(opt).from(htmlElementCopy).save();
    }
</script>

<button class="btn btn-sm variant-filled-secondary group" on:click={() => print()}>
    <DownloadIcon class="group-hover:animate-pulse" />
    <span>Download as PDF</span>
</button>
