import { browser } from '$app/environment';

export interface Sample {
	ts: number; // epoch ms
	providerId: string;
	model: string;
	latencyMs: number;
	ttftMs: number | null;
	tokensPerSec: number | null;
	ok: boolean;
	error?: string;
}

/* ============================================================================
   IndexedDB — samples (can grow large, kept out of localStorage)
   ========================================================================== */
const DB_NAME = 'llmavg';
const STORE = 'samples';
/** Keep at most this many samples; oldest pruned on insert. */
export const MAX_SAMPLES = 5000;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
				os.createIndex('ts', 'ts');
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	return dbPromise;
}

export async function addSample(s: Sample): Promise<void> {
	if (!browser) return;
	const db = await openDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		const os = tx.objectStore(STORE);
		os.add(s);
		// Prune oldest rows beyond the cap (cursor walks the ts index ascending).
		const countReq = os.count();
		countReq.onsuccess = () => {
			let overflow = countReq.result - MAX_SAMPLES;
			if (overflow <= 0) return;
			os.index('ts').openCursor().onsuccess = (e) => {
				const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor && overflow > 0) {
					cursor.delete();
					overflow--;
					cursor.continue();
				}
			};
		};
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getAllSamples(): Promise<Sample[]> {
	if (!browser) return [];
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).getAll();
		req.onsuccess = () => resolve((req.result as Sample[]).sort((a, b) => a.ts - b.ts));
		req.onerror = () => reject(req.error);
	});
}

export async function clearSamples(): Promise<void> {
	if (!browser) return;
	const db = await openDB();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).clear();
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

/* ============================================================================
   localStorage — API keys + UI settings (small, synchronous)
   ========================================================================== */
const KEY_PREFIX = 'llmavg:key:';
const SETTINGS_KEY = 'llmavg:settings';
const CUSTOM_KEY = 'llmavg:custom';

export function getApiKey(providerId: string): string {
	if (!browser) return '';
	return localStorage.getItem(KEY_PREFIX + providerId) ?? '';
}

export function setApiKey(providerId: string, key: string): void {
	if (!browser) return;
	if (key) localStorage.setItem(KEY_PREFIX + providerId, key);
	else localStorage.removeItem(KEY_PREFIX + providerId);
}

export interface Settings {
	providerId: string;
	models: Record<string, string>; // providerId -> model
	intervalMs: number;
	maxTokens: number;
	prompt: string;
	/** Provider ids selected for simultaneous benchmarking. Empty = single active provider. */
	selected: string[];
	/** @deprecated migrated to `selected` */
	raceMode?: boolean;
}

export function loadSettings(): Partial<Settings> {
	if (!browser) return {};
	try {
		return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
	} catch {
		return {};
	}
}

export function saveSettings(s: Settings): void {
	if (!browser) return;
	localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

import type { CustomProviderConfig } from './providers/custom';

export function loadCustom(): CustomProviderConfig[] {
	if (!browser) return [];
	try {
		const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]');
		return Array.isArray(list) ? list : [];
	} catch {
		return [];
	}
}

export function saveCustom(list: CustomProviderConfig[]): void {
	if (!browser) return;
	localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

/* ============================================================================
   Export helpers
   ========================================================================== */
export function samplesToCSV(samples: Sample[]): string {
	const head = 'iso_time,provider,model,ok,latency_ms,ttft_ms,tokens_per_sec,error';
	const rows = samples.map((s) =>
		[
			new Date(s.ts).toISOString(),
			s.providerId,
			s.model,
			s.ok ? '1' : '0',
			s.ok ? s.latencyMs : '',
			s.ttftMs ?? '',
			s.tokensPerSec ?? '',
			s.error ? `"${s.error.replace(/"/g, '""')}"` : ''
		].join(',')
	);
	return [head, ...rows].join('\n');
}
