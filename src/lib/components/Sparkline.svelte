<script lang="ts">
	import { onMount } from 'svelte';

	let { values, unit = 'ms' }: { values: number[]; unit?: string } = $props();

	const TICKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

	let wrapW = $state(0);
	let charW = $state(9);
	let ruler = $state<HTMLSpanElement>();

	onMount(() => {
		if (ruler) charW = ruler.getBoundingClientRect().width / 10 || 9;
	});

	const cols = $derived(Math.max(8, Math.floor(wrapW / charW)));

	// Downsample to fill the available width: bucket-average when we have more
	// points than columns; otherwise show each point.
	const series = $derived.by(() => {
		if (values.length <= cols) return values;
		const out: number[] = [];
		const size = values.length / cols;
		for (let i = 0; i < cols; i++) {
			const slice = values.slice(Math.floor(i * size), Math.floor((i + 1) * size));
			out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
		}
		return out;
	});

	const spark = $derived.by(() => {
		if (!series.length) return '';
		const min = Math.min(...series);
		const max = Math.max(...series);
		const span = max - min || 1;
		return series.map((v) => TICKS[Math.min(7, Math.round(((v - min) / span) * 7))]).join('');
	});

	const min = $derived(values.length ? Math.min(...values) : null);
	const max = $derived(values.length ? Math.max(...values) : null);
	const last = $derived(values.length ? values[values.length - 1] : null);
	const fmt = (v: number | null) => (v == null ? '·' : `${Math.round(v).toLocaleString()}${unit}`);
</script>

<span bind:this={ruler} class="invisible absolute text-[15px]">██████████</span>

<div class="text-[12px]">
	<div
		class="overflow-hidden text-[15px] leading-none whitespace-pre text-amber-bright"
		bind:clientWidth={wrapW}
	>
		{spark || '·'}
	</div>
	<div class="mt-3 flex gap-4 text-amber-dim">
		<span>min {fmt(min)}</span>
		<span>max {fmt(max)}</span>
		<span>last <span class="text-foreground">{fmt(last)}</span></span>
		<span>n {values.length}</span>
	</div>
</div>
