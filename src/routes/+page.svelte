<script lang="ts">
	import { onMount } from 'svelte';
	import { dash } from '$lib/dashboard.svelte';
	import AsciiBars from '$lib/components/AsciiBars.svelte';
	import Sparkline from '$lib/components/Sparkline.svelte';
	import TuiPanel from '$lib/components/TuiPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import Select from '$lib/components/Select.svelte';
	import SkcriptMark from '$lib/components/SkcriptMark.svelte';

	const VERSION = '0.1.0';

	let metric = $state<'latencyMs' | 'ttftMs' | 'tokensPerSec'>('latencyMs');
	let showSettings = $state(false);
	let now = $state(Date.now());

	onMount(() => {
		void dash.init().then(() => {
			// Open config on the very first visit only (until a key exists / they dismiss).
			if (!dash.apiKey.trim() && !localStorage.getItem('llmavg:seen')) showSettings = true;
			localStorage.setItem('llmavg:seen', '1');
		});
		return () => dash.destroy();
	});

	$effect(() => {
		if (!dash.running) return;
		const t = setInterval(() => (now = Date.now()), 250);
		return () => clearInterval(t);
	});
	const countdown = $derived(
		dash.running && dash.nextPingAt ? Math.max(0, Math.ceil((dash.nextPingAt - now) / 1000)) : null
	);
	// Shrinking progress bar toward the next ping.
	const pb = $derived.by(() => {
		if (!dash.running || !dash.nextPingAt) return null;
		const frac = Math.max(0, Math.min(1, (dash.nextPingAt - now) / dash.intervalMs));
		const w = 12;
		const filled = Math.round(frac * w);
		return { filled: '█'.repeat(filled), track: '░'.repeat(w - filled) };
	});

	const fmtMs = (v: number | null) => (v == null ? '·' : `${v.toLocaleString()} ms`);
	const fmtTps = (v: number | null) => (v == null ? '·' : `${v}`);
	const fmtPct = (v: number | null) => (v == null ? '·' : `${Math.round(v * 100)}%`);
	const fmtTime = (ts: number) =>
		new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

	const hasData = $derived(dash.summary.okCount > 0);
	const recent = $derived([...dash.samples].slice(-30).reverse());

	const viewOptions = $derived([
		{ value: 'all', label: 'all providers' },
		...dash.comparison.map((c) => ({ value: c.provider.id, label: c.provider.label }))
	]);

	const metricUnit = $derived(metric === 'tokensPerSec' ? '' : 'ms');
	const hourRows = $derived(
		dash.hours.map((b) => ({
			label: String(b.hour).padStart(2, '0'),
			value:
				metric === 'latencyMs' ? b.avgLatency : metric === 'ttftMs' ? b.avgTtft : b.avgTps,
			count: b.count
		}))
	);
	const timeline = $derived(dash.viewSamples.filter((s) => s.ok).slice(-300).map((s) => s.latencyMs));
	const viewLabel = $derived(
		dash.viewFilter === 'all'
			? 'all'
			: (dash.allProviders.find((p) => p.id === dash.viewFilter)?.label ?? dash.viewFilter)
	);

	// Keyboard shortcuts (ignored while typing in a field or with the modal open).
	function onKey(e: KeyboardEvent) {
		if (showSettings || e.metaKey || e.ctrlKey || e.altKey) return;
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
		switch (e.key) {
			case 's':
				if (dash.canMeasure) dash.toggle();
				break;
			case 'p':
				if (dash.canMeasure && !dash.pinging) dash.pingOnce();
				break;
			case 'c':
				showSettings = true;
				break;
			case 'x':
				if (dash.samples.length) dash.clear();
				break;
			case 't':
				metric =
					metric === 'latencyMs' ? 'ttftMs' : metric === 'ttftMs' ? 'tokensPerSec' : 'latencyMs';
				break;
		}
	}

	const slower = $derived(
		dash.summary.dayAvg != null && dash.summary.nightAvg != null
			? dash.summary.dayAvg > dash.summary.nightAvg
				? 'day'
				: 'night'
			: null
	);

	const stats = $derived([
		['last', fmtMs(dash.summary.last?.ok ? dash.summary.last.latencyMs : null)],
		['avg', fmtMs(dash.summary.avgLatency)],
		['p50', fmtMs(dash.summary.p50)],
		['p95', fmtMs(dash.summary.p95)],
		['p99', fmtMs(dash.summary.p99)],
		['jitter σ', fmtMs(dash.summary.jitter)],
		['ttft', fmtMs(dash.summary.avgTtft)],
		['tok/s', fmtTps(dash.summary.avgTps)],
		['samples', String(dash.summary.count)],
		['err', fmtPct(dash.summary.errRate)]
	] as const);
</script>

<svelte:head>
	<title>llm-latency</title>
</svelte:head>

<svelte:window onkeydown={onKey} />
<SettingsModal bind:open={showSettings} />

<div class="crt mx-auto max-w-[78rem] px-4 pt-8 pb-16">
	<!-- Header -->
	<header
		class="mb-4 flex flex-wrap items-center justify-between gap-2 border border-border bg-background-alt px-4 py-3"
	>
		<div class="flex items-center gap-3">
			<SkcriptMark class="h-5 w-5 text-amber-bright" />
			<h1 class="text-xl font-bold tracking-wide text-amber-bright">
				LLM&#8209;LATENCY<span class="cursor ml-1"></span>
			</h1>
			<span class="text-[11px] text-amber-dim">v{VERSION}</span>
		</div>
		<span class="text-[12px] text-amber-dim">response-time monitor · keys local-only</span>
	</header>

	<!-- Command bar -->
	<div class="mb-4 flex flex-wrap items-center gap-2 border border-border bg-background-alt p-2.5 text-[13px]">
		<button
			onclick={() => (showSettings = true)}
			class="border border-border px-2.5 py-1 text-amber-dim hover:bg-secondary hover:text-amber-bright"
		>
			[cfg]
			{#if dash.isBenchmark}
				<span class="text-amber-bright">benchmark</span>:{dash.targets.length}
			{:else}
				<span class="text-foreground">{dash.provider.id}</span>
				<span class="text-amber-dim">{dash.model}</span>
			{/if}
		</button>

		<span class="grow truncate text-amber-dim">
			{#if dash.running && countdown != null}
				{#if dash.pinging}
					<span class="whitespace-pre">» <span class="text-amber-bright">pinging…</span></span>
				{:else if pb}
					<span class="whitespace-pre"
						>» next ping <span class="text-amber-bright">{pb.filled}</span><span
							class="text-amber-dim/40">{pb.track}</span
						> {countdown}s</span
					>
				{/if}
			{:else if dash.status.msg}
				<span
					class={dash.status.kind === 'bad'
						? 'text-danger'
						: dash.status.kind === 'ok'
							? 'text-amber-bright'
							: 'text-amber-dim'}
				>
					» {dash.status.msg}
				</span>
			{/if}
		</span>

		<button
			onclick={() => dash.pingOnce()}
			disabled={dash.pinging || !dash.canMeasure}
			class="border border-border px-3 py-1 hover:bg-secondary hover:text-amber-bright disabled:opacity-40"
		>
			[ping]
		</button>
		<button
			onclick={() => dash.toggle()}
			disabled={!dash.canMeasure}
			class="border px-3 py-1 font-bold disabled:opacity-40 {dash.running
				? 'border-danger text-danger hover:bg-danger hover:text-background'
				: 'border-amber-bright text-amber-bright hover:bg-amber-bright hover:text-background'}"
		>
			{dash.running ? '[stop]' : '[start]'}
		</button>
	</div>

	<!-- Benchmark selection -->
	<div class="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
		<span class="text-amber-dim">benchmark:</span>
		{#each dash.allProviders as p (p.id)}
			{@const on = dash.selected.includes(p.id)}
			{@const keyed = dash.hasKey(p.id)}
			<button
				onclick={() => keyed && dash.toggleSelected(p.id)}
				disabled={!keyed}
				title={keyed ? 'toggle in benchmark' : 'add key in [cfg]'}
				class="border px-2 py-1 {on
					? 'chip-hot'
					: keyed
						? 'border-border text-foreground hover:text-amber-bright'
						: 'border-border text-amber-dim opacity-50'}"
			>
				{on ? '◉' : keyed ? '○' : '·'}
				{p.label}
			</button>
		{/each}
		{#if dash.selected.length}
			<button
				onclick={() => (dash.selected = [])}
				class="text-amber-dim underline underline-offset-2 hover:text-amber-bright"
			>
				clear
			</button>
		{:else}
			<span class="text-amber-dim">pick 2+ to compare · none = single active</span>
		{/if}
	</div>

	{#if !dash.canMeasure}
		<button
			onclick={() => (showSettings = true)}
			class="mb-4 w-full border border-dashed border-border bg-background-alt px-3 py-2.5 text-left text-[13px] text-amber-dim hover:border-amber-bright hover:text-amber-bright"
		>
			! no api key — press [cfg] to add a provider key
		</button>
	{/if}

	{#if dash.comparison.length > 1}
		<div class="mb-4 flex items-center gap-2 text-[13px]">
			<span class="text-amber-dim">view:</span>
			<Select bind:value={dash.viewFilter} options={viewOptions} />
		</div>
	{/if}

	<div class="grid gap-4 lg:grid-cols-2">
		<!-- Metrics -->
		<TuiPanel title="metrics">
			<div class="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
				{#each stats as [label, value] (label)}
					<div class="flex items-baseline justify-between gap-2 border-b border-border/40 pb-1">
						<span class="text-amber-dim">{label}</span>
						{#if label === 'p95' && dash.summary.p95 != null}
							<span class="chip-hot">{value}</span>
						{:else}
							<span class="text-amber-bright">{value}</span>
						{/if}
					</div>
				{/each}
			</div>
		</TuiPanel>

		<!-- Day vs night -->
		<TuiPanel title="day / night">
			<div class="grid grid-cols-2 gap-4 text-[13px]">
				{#snippet dn(name: string, sub: string, v: number | null, count: number, isSlow: boolean)}
					<div class="border p-3 {isSlow ? 'border-amber-bright' : 'border-border'}">
						<div class="flex justify-between text-amber-dim">
							<span>{name} {sub}</span>
							{#if isSlow}<span class="text-amber-bright">slower</span>{/if}
						</div>
						<div class="mt-1 text-lg font-bold">
							{#if isSlow && v != null}
								<span class="chip-hot">{fmtMs(v)}</span>
							{:else}
								<span class="text-amber-bright">{fmtMs(v)}</span>
							{/if}
						</div>
						<div class="text-[11px] text-amber-dim">{count} samples</div>
					</div>
				{/snippet}
				{@render dn('SUN', '06-18', dash.summary.dayAvg, dash.summary.dayCount, slower === 'day')}
				{@render dn('MOON', '18-06', dash.summary.nightAvg, dash.summary.nightCount, slower === 'night')}
			</div>
		</TuiPanel>
	</div>

	<!-- Provider comparison -->
	{#if dash.comparison.length > 1}
		<div class="mt-4">
			<TuiPanel title="provider comparison">
				<div class="overflow-x-auto text-[12px]">
					<table class="w-full border-collapse whitespace-pre">
						<thead>
							<tr class="text-left text-amber-dim">
								<th class="py-1 pr-4">provider</th>
								<th class="py-1 pr-4">n</th>
								<th class="py-1 pr-4">avg</th>
								<th class="py-1 pr-4">p50</th>
								<th class="py-1 pr-4">p95</th>
								<th class="py-1 pr-4">tok/s</th>
								<th class="py-1">err</th>
							</tr>
						</thead>
						<tbody>
							{#each dash.comparison as c (c.provider.id)}
								<tr class="border-t border-border/40">
									<td class="py-1 pr-4 text-foreground">{c.provider.label}</td>
									<td class="py-1 pr-4">{c.summary.count}</td>
									<td class="py-1 pr-4">{fmtMs(c.summary.avgLatency)}</td>
									<td class="py-1 pr-4">{fmtMs(c.summary.p50)}</td>
									<td class="py-1 pr-4 text-amber-bright">{fmtMs(c.summary.p95)}</td>
									<td class="py-1 pr-4">{fmtTps(c.summary.avgTps)}</td>
									<td class="py-1">{fmtPct(c.summary.errRate)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</TuiPanel>
		</div>
	{/if}

	<!-- Timeline -->
	<div class="mt-4">
		<TuiPanel title="latency · recent pings · {viewLabel}">
			{#if hasData}
				<Sparkline values={timeline} />
				{#if dash.viewFilter === 'all' && dash.comparison.length > 1}
					<p class="mt-2 text-[11px] text-amber-dim">
						mixed providers — set <span class="text-foreground">view:</span> above to isolate one
					</p>
				{/if}
			{:else}
				<p class="text-[12px] text-amber-dim">no pings yet</p>
			{/if}
		</TuiPanel>
	</div>

	<!-- Hour chart -->
	<div class="mt-4">
		<TuiPanel title="average by hour of day">
			{#snippet actions()}
				<span class="bg-background-alt">
					{#each [['latencyMs', 'total'], ['ttftMs', 'ttft'], ['tokensPerSec', 'tok/s']] as const as [m, lbl], i (m)}
						{#if i > 0}<span class="text-amber-dim"> · </span>{/if}
						<button
							onclick={() => (metric = m)}
							class={metric === m ? 'text-amber-bright' : 'text-amber-dim hover:text-foreground'}
						>
							{lbl}
						</button>
					{/each}
				</span>
			{/snippet}
			{#if hasData}
				<AsciiBars rows={hourRows} unit={metricUnit} />
			{:else}
				<p class="text-[12px] text-amber-dim">no data yet — start measuring to fill 24h</p>
			{/if}
			<p class="mt-3 text-[11px] text-amber-dim">
				local timezone · leave tab open to fill day &amp; night
			</p>
		</TuiPanel>
	</div>

	<!-- Samples -->
	<div class="mt-4">
		<TuiPanel title="recent samples">
			{#snippet actions()}
				<span class="bg-background-alt">
					<button
						onclick={() => dash.exportCSV()}
						disabled={!dash.samples.length}
						class="text-amber-dim hover:text-amber-bright disabled:opacity-40">csv</button
					><span class="text-amber-dim"> · </span><button
						onclick={() => dash.exportJSON()}
						disabled={!dash.samples.length}
						class="text-amber-dim hover:text-amber-bright disabled:opacity-40">json</button
					><span class="text-amber-dim"> · </span><button
						onclick={() => dash.clear()}
						disabled={!dash.samples.length}
						class="text-amber-dim hover:text-danger disabled:opacity-40">clear</button
					>
				</span>
			{/snippet}
			<div class="overflow-x-auto text-[12px]">
				<table class="w-full border-collapse whitespace-pre">
					<thead>
						<tr class="text-left text-amber-dim">
							<th class="py-1 pr-4">time</th>
							<th class="py-1 pr-4">provider</th>
							<th class="py-1 pr-4">total</th>
							<th class="py-1 pr-4">ttft</th>
							<th class="py-1 pr-4">tok/s</th>
							<th class="py-1">status</th>
						</tr>
					</thead>
					<tbody>
						{#each recent as s (s.ts)}
							<tr class="border-t border-border/40">
								<td class="py-1 pr-4">{fmtTime(s.ts)}</td>
								<td class="py-1 pr-4 text-amber-dim">{s.providerId}</td>
								<td class="py-1 pr-4">{s.ok ? s.latencyMs : '·'}</td>
								<td class="py-1 pr-4">{s.ttftMs ?? '·'}</td>
								<td class="py-1 pr-4">{s.tokensPerSec ?? '·'}</td>
								<td class="py-1 {s.ok ? 'text-amber-bright' : 'text-danger'}">
									{s.ok ? 'ok' : (s.error ?? 'fail')}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="6" class="py-5 text-center text-amber-dim">
									no samples — add key, press [ping]
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</TuiPanel>
	</div>
</div>

<StatusBar {countdown} />
