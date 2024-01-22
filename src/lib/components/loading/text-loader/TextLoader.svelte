<script lang="ts">
</script>

<div class="h-full flex flex-col items-center justify-center select-none">
    <div id="container" class="font-bold text-surface-100 text-4xl text-center uppercase">
        We are
        <div id="flip" class="h-10 overflow-hidden text-surface-50">
            <div><div class="inline-block h-10 px-3 mb-11 bg-primary-500">Crafting</div></div>
            <div>
                <div class="inline-block h-10 px-3 mb-11 bg-secondary-500">Preparing</div>
            </div>
            <div><div class="inline-block h-10 px-3 mb-11 bg-tertiary-700">Building</div></div>
        </div>
        your plan
    </div>
</div>

<style>
    #flip div:first-child {
        animation: show 5s linear infinite;
    }

    @keyframes show {
        0% {
            margin-top: -260px;
        }
        5% {
            margin-top: -167px;
        }
        33% {
            margin-top: -167px;
        }
        38% {
            margin-top: -85px;
        }
        66% {
            margin-top: -85px;
        }
        71% {
            margin-top: 0px;
        }
        99.99% {
            margin-top: 0px;
        }
        100% {
            margin-top: -260px;
        }
    }
</style>
