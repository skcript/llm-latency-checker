import type { PingOptions, PingResult } from './types';
import { readSSE, estimateTokens, throughput, failResult, errMsg } from './sse';

/**
 * Stream a chat completion from any OpenAI-compatible endpoint and measure
 * latency / TTFT / throughput. Powers the built-in OpenAI provider and every
 * user-defined custom provider (Groq, Together, OpenRouter, Ollama, vLLM, …).
 *
 * @param baseUrl API root, e.g. `https://api.openai.com/v1` (no trailing slash).
 */
export async function pingOpenAICompatible(
	baseUrl: string,
	opts: PingOptions
): Promise<PingResult> {
	const { apiKey, model, prompt, maxTokens, signal } = opts;
	const start = performance.now();
	let ttftMs: number | null = null;
	let text = '';
	let usageTokens: number | null = null;

	const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model,
				messages: [{ role: 'user', content: prompt }],
				max_tokens: maxTokens,
				stream: true,
				stream_options: { include_usage: true }
			}),
			signal
		});

		if (!res.ok) {
			const body = await res.text();
			return failResult(res.status, body || res.statusText, start);
		}

		await readSSE(res, (payload) => {
			if (payload === '[DONE]') return;
			let chunk: any;
			try {
				chunk = JSON.parse(payload);
			} catch {
				return;
			}
			const delta = chunk?.choices?.[0]?.delta?.content;
			if (typeof delta === 'string' && delta.length) {
				if (ttftMs === null) ttftMs = performance.now() - start;
				text += delta;
			}
			if (chunk?.usage?.completion_tokens != null) {
				usageTokens = chunk.usage.completion_tokens;
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
