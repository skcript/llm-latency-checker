<script lang="ts">
	import { onMount } from 'svelte';

	type Row = { label: string; value: number | null; count?: number };
	let { rows, unit = '' }: { rows: Row[]; unit?: string } = $props();

	const PARTIALS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

	let wrapW = $state(0);
	let charW = $state(7.3);
	let ruler = $state<HTMLSpanElement>();

	onMount(() => {
		if (ruler) charW = ruler.getBoundingClientRect().width / 10 || 7.3;
	});

	// Bar track fills the panel: total cols from width minus label/sep/value reserve.
	const cols = $derived(Math.max(16, Math.floor(wrapW / charW) - 14));
	const max = $derived(Math.max(1, ...rows.map((r) => r.value ?? 0)));

	function bar(value: number | null) {
		if (value == null) return { fill: '', track: '░'.repeat(cols) };
		const frac = value / max;
		const full = Math.floor(frac * cols);
		const rem = frac * cols - full;
		const partial = rem > 0.05 ? PARTIALS[Math.min(7, Math.round(rem * 8))] : '';
		const used = full + (partial ? 1 : 0);
		return { fill: '█'.repeat(full) + partial, track: '░'.repeat(Math.max(0, cols - used)) };
	}
</script>

<span bind:this={ruler} class="invisible absolute text-[12px]">██████████</span>

<div class="text-[12px] leading-[1.5]" bind:clientWidth={wrapW}>
	{#each rows as r (r.label)}
		{@const b = bar(r.value)}
		<div class="flex items-center gap-2 whitespace-pre">
			<span class="w-6 text-right text-amber-dim">{r.label}</span>
			<span class="text-amber-dim">│</span>
			<span class="text-amber-bright">{b.fill}</span><span class="text-amber-dim/40">{b.track}</span>
			<span class="ml-1 text-foreground">
				{r.value == null ? '·' : `${r.value.toLocaleString()}${unit}`}
			</span>
		</div>
	{/each}
</div>
