/**
 * Read a Server-Sent-Events response body, invoking `onData` with each
 * `data:` payload string (one per event). Works for Gemini (alt=sse),
 * OpenAI, and Anthropic streaming responses.
 */
export async function readSSE(
	response: Response,
	onData: (payload: string) => void
): Promise<void> {
	const reader = response.body?.getReader();
	if (!reader) return;
	const decoder = new TextDecoder();
	let buffer = '';

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		// SSE events are separated by a blank line. Process complete lines.
		let nl: number;
		while ((nl = buffer.indexOf('\n')) !== -1) {
			const line = buffer.slice(0, nl).replace(/\r$/, '');
			buffer = buffer.slice(nl + 1);
			if (line.startsWith('data:')) {
				const payload = line.slice(5).trim();
				if (payload) onData(payload);
			}
		}
	}
	// Flush any trailing line.
	const tail = buffer.trim();
	if (tail.startsWith('data:')) {
		const payload = tail.slice(5).trim();
		if (payload) onData(payload);
	}
}

/** Rough fallback token estimate when a provider omits usage. ~4 chars/token. */
export function estimateTokens(text: string): number {
	return Math.max(1, Math.round(text.length / 4));
}

/** Compute tokens/sec over the generation window (after first token). */
export function throughput(
	outputTokens: number | null,
	ttftMs: number | null,
	totalMs: number
): number | null {
	if (outputTokens == null || ttftMs == null) return null;
	const genMs = totalMs - ttftMs;
	if (genMs <= 0) return null;
	return +(outputTokens / (genMs / 1000)).toFixed(1);
}

import type { PingResult } from './types';

/** Build a failed PingResult, measuring elapsed time from `start`. */
export function failResult(
	status: number | undefined,
	error: string,
	start: number
): PingResult {
	return {
		ok: false,
		latencyMs: Math.round(performance.now() - start),
		ttftMs: null,
		outputTokens: null,
		tokensPerSec: null,
		status,
		error: error.slice(0, 300)
	};
}

/** Normalize a thrown value to a short message; tags aborts. */
export function errMsg(err: unknown): string {
	if (err instanceof DOMException && err.name === 'AbortError') return 'aborted';
	return err instanceof Error ? err.message : String(err);
}
