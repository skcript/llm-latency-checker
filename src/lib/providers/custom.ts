import type { Provider } from './types';
import { pingOpenAICompatible } from './openaiCompat';

/** User-defined OpenAI-compatible endpoint (Groq, Together, OpenRouter, Ollama, …). */
export interface CustomProviderConfig {
	id: string; // e.g. 'cust_xxxx'
	label: string;
	baseUrl: string; // API root incl. version, e.g. https://api.groq.com/openai/v1
	model: string;
}

export function makeCustomProvider(cfg: CustomProviderConfig): Provider {
	return {
		id: cfg.id,
		label: cfg.label || cfg.id,
		defaultModel: cfg.model,
		keysUrl: cfg.baseUrl,
		ping: (opts) => pingOpenAICompatible(cfg.baseUrl, opts)
	};
}

export function newCustomId(): string {
	return `cust_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
