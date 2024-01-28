<script lang="ts">
	import Spinner from '../spinner/Spinner.svelte';
    import TextLoader from '../text-loader/TextLoader.svelte';
</script>

<div class="h-full flex flex-col items-center justify-center">
	<div class="h-50 pb-5">
		<TextLoader />
	</div>
	<div class="h-50">
		<Spinner size={10} />
	</div>
</div>