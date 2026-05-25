import type { Provider, PingOptions, PingResult } from './types';
import { readSSE, estimateTokens, throughput, failResult, errMsg } from './sse';

export const anthropic: Provider = {
	id: 'anthropic',
	label: 'Anthropic Claude',
	defaultModel: 'claude-haiku-4-5',
	keysUrl: 'https://console.anthropic.com/settings/keys',

	async ping(opts: PingOptions): Promise<PingResult> {
		const { apiKey, model, prompt, maxTokens, signal } = opts;
		const start = performance.now();
		let ttftMs: number | null = null;
		let text = '';
		let usageTokens: number | null = null;

		try {
			const res = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					// Required for direct browser calls (no server proxy).
					'anthropic-dangerous-direct-browser-access': 'true'
				},
				body: JSON.stringify({
					model,
					max_tokens: maxTokens,
					messages: [{ role: 'user', content: prompt }],
					stream: true
				}),
				signal
			});

			if (!res.ok) {
				const body = await res.text();
				return failResult(res.status, body || res.statusText, start);
			}

			await readSSE(res, (payload) => {
				let evt: any;
				try {
					evt = JSON.parse(payload);
				} catch {
					return;
				}
				if (evt?.type === 'content_block_delta') {
					const t = evt?.delta?.text;
					if (typeof t === 'string' && t.length) {
						if (ttftMs === null) ttftMs = performance.now() - start;
						text += t;
					}
				} else if (evt?.type === 'message_delta' && evt?.usage?.output_tokens != null) {
					usageTokens = evt.usage.output_tokens;
				}
			});
		} catch (err) {
			return failResult(undefined, errMsg(err), start);
		}

		const latencyMs = Math.round(performance.now() - start);
		const outputTokens = usageTokens ?? (text ? estimateTokens(text) : null);
		return {
			ok: true,
			latencyMs,
			ttftMs: ttftMs === null ? null : Math.round(ttftMs),
			outputTokens,
			tokensPerSec: throughput(outputTokens, ttftMs, latencyMs)
		};
	}
};
