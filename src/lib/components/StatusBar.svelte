<script lang="ts">
	import { dash } from '$lib/dashboard.svelte';
	import SkcriptMark from './SkcriptMark.svelte';

	let { countdown }: { countdown: number | null } = $props();

	const fmtMs = (v: number | null) => (v == null ? '·' : `${v}ms`);
</script>

<div
	class="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background-muted px-3 py-1.5 text-[12px]"
>
	<div class="mx-auto flex max-w-[78rem] flex-wrap items-center gap-x-3 gap-y-1">
		{#if dash.running}
			<span class="chip-hot">● RUN</span>
		{:else}
			<span class="font-bold text-amber-dim">○ IDLE</span>
		{/if}
		<span class="text-amber-dim">│</span>
		<span>{dash.isBenchmark ? `bench:${dash.targets.length}` : dash.provider.id}</span>
		<span class="text-amber-dim">│</span>
		{#if dash.running && countdown != null}
			<span class="text-amber-dim">next {dash.pinging ? '...' : countdown + 's'}</span>
			<span class="text-amber-dim">│</span>
		{/if}
		<span class="text-amber-dim">n=<span class="text-foreground">{dash.summary.count}</span></span>
		<span class="text-amber-dim">│</span>
		<span class="text-amber-dim">avg <span class="text-foreground">{fmtMs(dash.summary.avgLatency)}</span></span>
		<span class="text-amber-dim">│</span>
		<span class="text-amber-dim">p95 <span class="text-amber-bright">{fmtMs(dash.summary.p95)}</span></span>
		<span class="text-amber-dim">│</span>
		<span class="text-amber-dim">err <span class="text-foreground">{dash.summary.errRate == null ? '·' : Math.round(dash.summary.errRate * 100) + '%'}</span></span>
		<span class="grow"></span>
		<span class="hidden text-amber-dim lg:inline">
			[s]tart [p]ing [c]fg [x]clear [t]oggle
		</span>
		<span class="text-amber-dim">│</span>
		<a
			href="https://www.skcript.com/research"
			target="_blank"
			rel="noopener"
			class="flex items-center gap-1.5 text-amber-dim hover:text-amber-bright"
		>
			<SkcriptMark class="h-3 w-3" />
			<span>R&amp;E · Skcript</span>
		</a>
	</div>
</div>
