<script lang="ts" generics="T extends string | number">
	type Option = { value: T; label: string };

	let {
		value = $bindable(),
		options,
		full = false
	}: { value: T; options: Option[]; full?: boolean } = $props();

	let open = $state(false);
	let root = $state<HTMLDivElement>();

	const selected = $derived(options.find((o) => o.value === value));

	function pick(v: T) {
		value = v;
		open = false;
	}
</script>

<svelte:window
	onclick={(e) => {
		if (open && root && !root.contains(e.target as Node)) open = false;
	}}
	onkeydown={(e) => {
		if (open && e.key === 'Escape') open = false;
	}}
/>

<div class="relative {full ? 'w-full' : ''}" bind:this={root}>
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background-muted px-3 py-2 text-left text-sm text-foreground hover:border-accent"
		aria-haspopup="listbox"
		aria-expanded={open}
	>
		<span class="truncate">{selected?.label ?? value}</span>
		<svg
			class="h-3.5 w-3.5 shrink-0 text-secondary-foreground transition-transform {open
				? 'rotate-180'
				: ''}"
			viewBox="0 0 12 12"
			fill="none"
		>
			<path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	{#if open}
		<ul
			role="listbox"
			class="absolute z-10 mt-1.5 max-h-64 w-full min-w-max overflow-auto rounded-lg border border-border bg-background p-1 shadow-xl"
		>
			{#each options as o (o.value)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={o.value === value}
						onclick={() => pick(o.value)}
						class="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-background-muted {o.value ===
						value
							? 'text-accent'
							: 'text-foreground'}"
					>
						{o.label}
						{#if o.value === value}<span class="text-accent">✓</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
