<script lang="ts">
	import { dash } from '$lib/dashboard.svelte';
	import Select from './Select.svelte';
	import { fade, scale } from 'svelte/transition';

	let { open = $bindable() }: { open: boolean } = $props();

	const intervalOptions = [
		{ value: 30_000, label: '30s' },
		{ value: 60_000, label: '1 min' },
		{ value: 300_000, label: '5 min' },
		{ value: 900_000, label: '15 min' }
	];

	const statusColor = $derived(
		dash.status.kind === 'ok'
			? 'text-amber-bright'
			: dash.status.kind === 'bad'
				? 'text-danger'
				: dash.status.kind === 'wait'
					? 'text-amber-bright'
					: 'text-amber-dim'
	);

	// Add-provider form
	let nl = $state('');
	let nb = $state('');
	let nm = $state('');
	let addNameEl = $state<HTMLInputElement>();

	function focusAdd() {
		addNameEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		addNameEl?.focus();
	}

	const PRESETS = [
		{ label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
		{ label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
		{ label: 'Together', baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
		{ label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' }
	];

	function applyPreset(p: (typeof PRESETS)[number]) {
		nl = p.label;
		nb = p.baseUrl;
		nm = p.model;
	}

	function addProvider() {
		if (!nb.trim() || !nm.trim()) return;
		const id = dash.addCustom(nl.trim() || nb.trim(), nb.trim(), nm.trim());
		dash.providerId = id; // select it so the key field below targets it
		nl = nb = nm = '';
	}

	const inputCls =
		'w-full border border-border bg-background-muted px-3 py-2 text-sm text-foreground';

	function close() {
		open = false;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (open && e.key === 'Escape') close();
	}}
/>

{#if open}
	<div
		class="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
		role="presentation"
		transition:fade={{ duration: 150 }}
		onclick={(e) => {
			if (e.target === e.currentTarget) close();
		}}
	>
		<div
			class="my-auto w-full max-w-lg border border-amber-bright/60 bg-background-alt p-6 shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-label="Settings"
			transition:scale={{ duration: 180, start: 0.96, opacity: 0 }}
		>
			<div class="mb-5 flex items-center justify-between border-b border-border pb-3">
				<h2 class="text-base font-bold tracking-widest text-amber-bright">┤ CONFIG ├</h2>
				<button
					onclick={close}
					aria-label="Close"
					class="grid h-7 w-7 place-items-center border border-border text-amber-dim hover:text-amber-bright"
				>
					✕
				</button>
			</div>

			<div class="flex flex-col gap-4">
				<!-- Provider tabs -->
				<div class="flex flex-wrap gap-1.5">
					{#each dash.allProviders as p (p.id)}
						<button
							onclick={() => (dash.providerId = p.id)}
							class="flex items-center gap-1.5 border px-3 py-1.5 text-sm {dash.providerId === p.id
								? 'chip-hot'
								: 'border-border text-amber-dim hover:text-amber-bright'}"
						>
							<span
								class="inline-block h-1.5 w-1.5 rounded-full {dash.hasKey(p.id)
									? dash.providerId === p.id
										? 'bg-background'
										: 'bg-amber-bright'
									: 'bg-amber-dim/40'}"
							></span>
							{p.label}
						</button>
					{/each}
					<button
						onclick={focusAdd}
						class="border border-dashed border-border px-3 py-1.5 text-sm text-amber-dim hover:text-amber-bright"
					>
						+ custom
					</button>
				</div>

				<label class="flex flex-col gap-1.5 text-xs text-amber-dim">
					Model — {dash.provider.label}
					<input
						bind:value={dash.models[dash.providerId]}
						placeholder={dash.provider.defaultModel}
						class={inputCls}
					/>
				</label>

				<label class="flex flex-col gap-1.5 text-xs text-amber-dim">
					API key — {dash.provider.label}
					<input
						type="password"
						bind:value={dash.keys[dash.providerId]}
						placeholder="paste key — stored only in this browser"
						autocomplete="off"
						class={inputCls}
					/>
				</label>

				<div class="flex items-center gap-3 text-sm">
					<button
						onclick={() => dash.checkKey()}
						class="border border-border px-4 py-2 hover:border-amber-bright hover:text-amber-bright"
					>
						Check key
					</button>
					<a
						href={dash.provider.keysUrl}
						target="_blank"
						rel="noopener"
						class="text-[12px] text-amber-dim underline underline-offset-2 hover:text-amber-bright"
					>
						{dash.provider.id.startsWith('cust_') ? 'endpoint ↗' : 'Get a key ↗'}
					</a>
					{#if dash.status.msg}
						<span class="ml-auto text-[12px] {statusColor}">{dash.status.msg}</span>
					{/if}
				</div>

				<hr class="border-border" />

				<!-- Custom providers -->
				<div class="flex flex-col gap-2">
					<span class="text-xs tracking-widest text-amber-dim uppercase">
						┤ Custom LLMs (OpenAI-compatible) ├
					</span>

					{#each dash.customConfigs as c (c.id)}
						<div class="flex flex-wrap items-center gap-2 border border-border p-2 text-[12px]">
							<input
								value={c.label}
								oninput={(e) => dash.updateCustom(c.id, { label: e.currentTarget.value })}
								placeholder="name"
								class="w-24 border border-border bg-background-muted px-2 py-1 text-foreground"
							/>
							<input
								value={c.baseUrl}
								oninput={(e) => dash.updateCustom(c.id, { baseUrl: e.currentTarget.value })}
								placeholder="https://…/v1"
								class="grow border border-border bg-background-muted px-2 py-1 text-foreground"
							/>
							<input
								value={dash.models[c.id] ?? c.model}
								oninput={(e) => dash.updateCustom(c.id, { model: e.currentTarget.value })}
								placeholder="model"
								class="w-32 border border-border bg-background-muted px-2 py-1 text-foreground"
							/>
							<input
								type="password"
								bind:value={dash.keys[c.id]}
								placeholder="key"
								autocomplete="off"
								class="w-20 border border-border bg-background-muted px-2 py-1 text-foreground"
							/>
							<button
								onclick={() => dash.removeCustom(c.id)}
								aria-label="Delete provider"
								class="border border-border px-2 py-1 text-amber-dim hover:border-danger hover:text-danger"
							>
								del
							</button>
						</div>
					{/each}

					<!-- Add form -->
					<div class="border border-dashed border-border p-2">
						<div class="mb-2 flex flex-wrap gap-1.5 text-[11px]">
							<span class="self-center text-amber-dim">presets:</span>
							{#each PRESETS as p (p.label)}
								<button
									onclick={() => applyPreset(p)}
									class="border border-border px-2 py-0.5 text-amber-dim hover:text-amber-bright"
								>
									{p.label}
								</button>
							{/each}
						</div>
						<div class="flex flex-wrap items-center gap-2 text-[12px]">
							<input bind:this={addNameEl} bind:value={nl} placeholder="name" class="w-24 border border-border bg-background-muted px-2 py-1 text-foreground" />
							<input bind:value={nb} placeholder="base URL (…/v1)" class="grow border border-border bg-background-muted px-2 py-1 text-foreground" />
							<input bind:value={nm} placeholder="model" class="w-32 border border-border bg-background-muted px-2 py-1 text-foreground" />
							<button
								onclick={addProvider}
								disabled={!nb.trim() || !nm.trim()}
								class="border border-amber-bright px-3 py-1 text-amber-bright hover:bg-amber-bright hover:text-background disabled:opacity-40"
							>
								+ add
							</button>
						</div>
					</div>
				</div>

				<hr class="border-border" />

				<p class="text-[12px] text-amber-dim">
					Add keys above, then pick which providers to benchmark together from the
					<span class="text-foreground">benchmark</span> strip on the dashboard. Selecting 2+ pings them
					simultaneously on each tick. ({dash.providersWithKey.length} keyed,
					{dash.selected.length} selected)
				</p>

				<hr class="border-border" />

				<div class="flex flex-wrap gap-3">
					<label class="flex flex-col gap-1.5 text-xs text-amber-dim">
						Interval
						<Select bind:value={dash.intervalMs} options={intervalOptions} />
					</label>
					<label class="flex flex-col gap-1.5 text-xs text-amber-dim">
						Max output tokens
						<input type="number" min="8" max="1024" bind:value={dash.maxTokens} class="w-28 border border-border bg-background-muted px-3 py-2 text-sm text-foreground" />
					</label>
					<label class="flex min-w-[200px] grow flex-col gap-1.5 text-xs text-amber-dim">
						Prompt
						<input bind:value={dash.prompt} class={inputCls} />
					</label>
				</div>
			</div>

			<button
				onclick={close}
				class="mt-6 w-full bg-amber-bright px-4 py-2.5 text-sm font-semibold text-background"
			>
				Done
			</button>
		</div>
	</div>
{/if}
