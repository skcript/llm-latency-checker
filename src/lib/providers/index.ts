import type { Provider } from './types';
import { gemini } from './gemini';
import { openai } from './openai';
import { anthropic } from './anthropic';

export type { Provider, PingOptions, PingResult } from './types';

/** Registry order = dropdown order. Gemini first (primary target). */
export const providers: Provider[] = [gemini, openai, anthropic];

export const providerMap: Record<string, Provider> = Object.fromEntries(
	providers.map((p) => [p.id, p])
);

export function getProvider(id: string): Provider {
	return providerMap[id] ?? gemini;
}
