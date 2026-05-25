import type { Provider, PingOptions, PingResult } from './types';
import { readSSE, estimateTokens, throughput, failResult, errMsg } from './sse';

export const gemini: Provider = {
	id: 'gemini',
	label: 'Google Gemini',
	defaultModel: 'gemini-2.0-flash',
	keysUrl: 'https://aistudio.google.com/apikey',

	async ping(opts: PingOptions): Promise<PingResult> {
		const { apiKey, model, prompt, maxTokens, signal } = opts;
		const url =
			`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}` +
			`:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

		const start = performance.now();
		let ttftMs: number | null = null;
		let text = '';
		let usageTokens: number | null = null;

		try {
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					contents: [{ role: 'user', parts: [{ text: prompt }] }],
					generationConfig: { maxOutputTokens: maxTokens }
				}),
				signal
			});

			if (!res.ok) {
				const body = await res.text();
				return failResult(res.status, body || res.statusText, start);
			}

			await readSSE(res, (payload) => {
				let chunk: any;
				try {
					chunk = JSON.parse(payload);
				} catch {
					return;
				}
				const parts = chunk?.candidates?.[0]?.content?.parts;
				if (Array.isArray(parts)) {
					for (const p of parts) {
						if (typeof p.text === 'string' && p.text.length) {
							if (ttftMs === null) ttftMs = performance.now() - start;
							text += p.text;
						}
					}
				}
				if (chunk?.usageMetadata?.candidatesTokenCount != null) {
					usageTokens = chunk.usageMetadata.candidatesTokenCount;
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
