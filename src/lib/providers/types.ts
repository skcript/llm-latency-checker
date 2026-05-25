export interface PingOptions {
	apiKey: string;
	model: string;
	prompt: string;
	maxTokens: number;
	signal?: AbortSignal;
}

export interface PingResult {
	ok: boolean;
	/** Total wall-clock time: request sent → stream fully read (ms). */
	latencyMs: number;
	/** Time to first token (ms). null if no token arrived. */
	ttftMs: number | null;
	/** Output tokens generated (from provider usage, or estimated). */
	outputTokens: number | null;
	/** Generation throughput after first token (tokens/sec). */
	tokensPerSec: number | null;
	/** HTTP status, when a response was received. */
	status?: number;
	/** Error message when ok === false. */
	error?: string;
}

export interface Provider {
	id: string;
	label: string;
	/** Default model id, editable by the user. */
	defaultModel: string;
	/** Where to get an API key. */
	keysUrl: string;
	/** Run one streamed request and measure latency, TTFT, throughput. */
	ping(opts: PingOptions): Promise<PingResult>;
}
