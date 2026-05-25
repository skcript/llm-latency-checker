<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		title,
		children,
		actions
	}: { title: string; children: Snippet; actions?: Snippet } = $props();
</script>

<section class="tui-panel">
	<span class="tui-panel__title">┤ {title} ├</span>
	{#if actions}
		<div class="absolute -top-[0.62em] right-4 bg-background-alt px-2 text-[0.7rem]">
			{@render actions()}
		</div>
	{/if}
	{@render children()}
</section>
