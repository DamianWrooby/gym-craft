<script lang="ts">
    // @ts-ignore
    import * as html2pdf from 'html2pdf.js';
    import { DownloadIcon } from 'svelte-feather-icons';

    export let htmlElement: HTMLElement;
    export let fileName: string;

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
        html2pdf().set(opt).from(htmlElementCopy).save();
    }
</script>

<button class="btn btn-sm variant-filled-secondary group" on:click={() => print()}>
    <DownloadIcon class="group-hover:animate-pulse" />
    <span>Download as PDF</span>
</button>
