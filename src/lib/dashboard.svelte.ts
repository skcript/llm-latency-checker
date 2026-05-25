import { providers as builtinProviders, type Provider } from './providers';
import {
	makeCustomProvider,
	newCustomId,
	type CustomProviderConfig
} from './providers/custom';
import {
	addSample,
	getAllSamples,
	clearSamples,
	getApiKey,
	setApiKey,
	loadSettings,
	saveSettings,
	loadCustom,
	saveCustom,
	samplesToCSV,
	MAX_SAMPLES,
	type Sample
} from './store';
import { aggregateByHour, summarize, type Summary } from './stats';

type Status = { kind: 'idle' | 'ok' | 'bad' | 'wait'; msg: string };

export interface ProviderComparison {
	provider: Provider;
	summary: Summary;
}

class Dashboard {
	providerId = $state('gemini');
	models = $state<Record<string, string>>({});
	keys = $state<Record<string, string>>({});
	intervalMs = $state(60_000);
	maxTokens = $state(64);
	prompt = $state('In one short sentence, describe the ocean.');

	/** User-defined OpenAI-compatible providers. */
	customConfigs = $state<CustomProviderConfig[]>([]);

	/** Provider ids selected for simultaneous benchmarking. Empty ⇒ single active provider. */
	selected = $state<string[]>([]);
	/** Which provider's data the charts/cards show ('all' = combined). */
	viewFilter = $state<'all' | string>('all');

	running = $state(false);
	pinging = $state(false);
	status = $state<Status>({ kind: 'idle', msg: '' });
	samples = $state<Sample[]>([]);
	/** Epoch ms of the next scheduled ping (0 when idle). For UI countdown. */
	nextPingAt = $state(0);

	#timer: ReturnType<typeof setInterval> | null = null;
	#controller: AbortController | null = null;
	#stopPersist: (() => void) | null = null;
	/** When the next interval tick is *expected* — used to detect sleep/throttle skew. */
	#expectedAt = 0;

	/** Built-in + custom providers, in display order. */
	get allProviders(): Provider[] {
		return [...builtinProviders, ...this.customConfigs.map(makeCustomProvider)];
	}
	get provider() {
		return this.allProviders.find((p) => p.id === this.providerId) ?? builtinProviders[0];
	}
	get model() {
		return this.models[this.providerId]?.trim() || this.provider.defaultModel;
	}
	get apiKey() {
		return this.keys[this.providerId] ?? '';
	}
	get providersWithKey(): Provider[] {
		return this.allProviders.filter((p) => (this.keys[p.id] ?? '').trim());
	}
	hasKey(id: string): boolean {
		return !!(this.keys[id] ?? '').trim();
	}
	get isBenchmark(): boolean {
		return this.targets.length > 1;
	}
	/** Providers measured on each ping: the selected set (with keys), else the active one. */
	get targets(): Provider[] {
		const sel = this.allProviders.filter((p) => this.selected.includes(p.id) && this.hasKey(p.id));
		if (sel.length) return sel;
		return this.apiKey.trim() ? [this.provider] : [];
	}
	get canMeasure() {
		return this.targets.length > 0;
	}
	/** Add/remove a provider from the benchmark selection. */
	toggleSelected(id: string) {
		this.selected = this.selected.includes(id)
			? this.selected.filter((x) => x !== id)
			: [...this.selected, id];
	}

	/** Samples scoped to the current view filter (drives charts, cards, timeline). */
	viewSamples = $derived(
		this.viewFilter === 'all'
			? this.samples
			: this.samples.filter((s) => s.providerId === this.viewFilter)
	);
	hours = $derived(aggregateByHour(this.viewSamples));
	summary = $derived(summarize(this.viewSamples));

	/** Per-provider summaries (from all samples) for the comparison table. */
	comparison = $derived<ProviderComparison[]>(
		this.allProviders
			.map((p) => ({
				provider: p,
				summary: summarize(this.samples.filter((s) => s.providerId === p.id))
			}))
			.filter((c) => c.summary.count > 0)
	);

	/** Load persisted state + wire up auto-save. Call once, in the browser. */
	async init() {
		const s = loadSettings();
		this.providerId = s.providerId ?? 'gemini';
		this.intervalMs = s.intervalMs ?? 60_000;
		this.maxTokens = s.maxTokens ?? 64;
		this.prompt = s.prompt ?? this.prompt;
		this.customConfigs = loadCustom();

		const models: Record<string, string> = {};
		const keys: Record<string, string> = {};
		for (const p of this.allProviders) {
			models[p.id] = s.models?.[p.id] ?? p.defaultModel;
			keys[p.id] = getApiKey(p.id);
		}
		this.models = models;
		this.keys = keys;

		// Selection: stored list, or migrate legacy raceMode (= all keyed providers).
		this.selected =
			s.selected ?? (s.raceMode ? this.allProviders.filter((p) => keys[p.id]?.trim()).map((p) => p.id) : []);

		this.samples = await getAllSamples();

		// Persist settings + keys reactively, outside any component.
		this.#stopPersist = $effect.root(() => {
			$effect(() => {
				saveSettings({
					providerId: this.providerId,
					models: { ...this.models },
					intervalMs: this.intervalMs,
					maxTokens: this.maxTokens,
					prompt: this.prompt,
					selected: $state.snapshot(this.selected)
				});
			});
			$effect(() => {
				for (const p of this.allProviders) setApiKey(p.id, this.keys[p.id] ?? '');
			});
			$effect(() => {
				saveCustom($state.snapshot(this.customConfigs));
			});
		});
	}

	/** Add a new OpenAI-compatible provider; returns its generated id. */
	addCustom(label: string, baseUrl: string, model: string): string {
		const id = newCustomId();
		this.customConfigs = [...this.customConfigs, { id, label, baseUrl, model }];
		this.models[id] = model;
		this.keys[id] = this.keys[id] ?? '';
		return id;
	}

	updateCustom(id: string, patch: Partial<Omit<CustomProviderConfig, 'id'>>) {
		this.customConfigs = this.customConfigs.map((c) =>
			c.id === id ? { ...c, ...patch } : c
		);
		if (patch.model) this.models[id] = patch.model;
	}

	removeCustom(id: string) {
		this.customConfigs = this.customConfigs.filter((c) => c.id !== id);
		this.keys[id] = '';
		this.selected = this.selected.filter((x) => x !== id);
		if (this.providerId === id) this.providerId = 'gemini';
		if (this.viewFilter === id) this.viewFilter = 'all';
	}

	destroy() {
		this.stop();
		this.#stopPersist?.();
	}

	/** Run one streamed measurement against a single provider and record it. */
	async #runProvider(p: Provider, signal: AbortSignal): Promise<Sample> {
		const model = this.models[p.id]?.trim() || p.defaultModel;
		const res = await p.ping({
			apiKey: (this.keys[p.id] ?? '').trim(),
			model,
			prompt: this.prompt,
			maxTokens: this.maxTokens,
			signal
		});
		const sample: Sample = {
			ts: Date.now(),
			providerId: p.id,
			model,
			latencyMs: res.latencyMs,
			ttftMs: res.ttftMs,
			tokensPerSec: res.tokensPerSec,
			ok: res.ok,
			error: res.error
		};
		await addSample(sample);
		return sample;
	}

	/** Measure all current targets (one, or all-with-keys in race mode). */
	async pingOnce(): Promise<void> {
		const targets = this.targets;
		if (!targets.length) {
			this.status = { kind: 'bad', msg: 'Add an API key first.' };
			return;
		}
		this.pinging = true;
		this.#controller = new AbortController();
		const signal = this.#controller.signal;

		const results = await Promise.all(targets.map((p) => this.#runProvider(p, signal)));
		this.pinging = false;

		// Append + keep in-memory list within the retention cap.
		const next = [...this.samples, ...results];
		this.samples = next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;

		const okCount = results.filter((r) => r.ok).length;
		if (targets.length === 1) {
			const r = results[0];
			this.status = r.ok
				? { kind: 'ok', msg: `${r.latencyMs} ms` }
				: { kind: 'bad', msg: `${r.error ?? 'failed'}`.trim() };
		} else {
			this.status = {
				kind: okCount === results.length ? 'ok' : okCount === 0 ? 'bad' : 'wait',
				msg: results
					.map((r) => `${r.providerId} ${r.ok ? r.latencyMs + 'ms' : '✕'}`)
					.join(' · ')
			};
		}
	}

	start() {
		if (this.running) return;
		if (!this.canMeasure) {
			this.status = { kind: 'bad', msg: 'Add an API key first.' };
			return;
		}
		this.running = true;
		void this.pingOnce();
		this.#expectedAt = Date.now() + this.intervalMs;
		this.nextPingAt = this.#expectedAt;
		this.#timer = setInterval(() => {
			const now = Date.now();
			const drift = now - this.#expectedAt;
			// Fell >half an interval behind → device slept or timers throttled.
			// Skip this tick so we don't record a bogus spike; resync the clock.
			if (drift > this.intervalMs * 0.5) {
				this.#expectedAt = now + this.intervalMs;
			} else {
				if (!this.pinging) void this.pingOnce();
				this.#expectedAt += this.intervalMs;
			}
			this.nextPingAt = this.#expectedAt;
		}, this.intervalMs);
	}

	stop() {
		this.running = false;
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		this.nextPingAt = 0;
		this.#controller?.abort();
	}

	toggle() {
		this.running ? this.stop() : this.start();
	}

	/** Validate the current provider's key with one tiny request (not stored). */
	async checkKey() {
		const key = this.apiKey.trim();
		if (!key) {
			this.status = { kind: 'bad', msg: 'Add an API key first.' };
			return;
		}
		this.status = { kind: 'wait', msg: 'Checking…' };
		const res = await this.provider.ping({
			apiKey: key,
			model: this.model,
			prompt: 'Reply with: ok',
			maxTokens: 8
		});
		this.status = res.ok
			? { kind: 'ok', msg: `Key works · ${res.latencyMs} ms` }
			: { kind: 'bad', msg: `${res.status ?? ''} ${res.error ?? 'invalid key'}`.trim() };
	}

	async clear() {
		this.stop();
		await clearSamples();
		this.samples = [];
		this.status = { kind: 'idle', msg: '' };
	}

	#download(content: string, type: string, ext: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `llm-latency-${new Date().toISOString().slice(0, 10)}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	}

	exportJSON() {
		this.#download(JSON.stringify(this.samples, null, 2), 'application/json', 'json');
	}

	exportCSV() {
		this.#download(samplesToCSV(this.samples), 'text/csv', 'csv');
	}
}

export const dash = new Dashboard();
