import type { Sample } from './store';

export interface HourBucket {
	hour: number; // 0–23, local time
	count: number; // ok samples in this hour
	avgLatency: number | null;
	avgTtft: number | null;
	avgTps: number | null;
}

export interface Summary {
	count: number; // total samples
	okCount: number;
	last: Sample | null;
	avgLatency: number | null;
	p50: number | null;
	p95: number | null;
	p99: number | null;
	jitter: number | null; // stddev of latency (ms)
	avgTtft: number | null;
	avgTps: number | null;
	errRate: number | null; // 0–1
	dayAvg: number | null; // avg latency 06:00–18:00 local
	dayCount: number;
	nightAvg: number | null; // avg latency 18:00–06:00 local
	nightCount: number;
}

function avg(nums: number[]): number | null {
	if (!nums.length) return null;
	return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Nearest-rank percentile (p in 0–100) over an unsorted number list. */
function percentile(nums: number[], p: number): number | null {
	if (!nums.length) return null;
	const sorted = [...nums].sort((a, b) => a - b);
	const rank = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)];
}

/** Sample standard deviation (ms), rounded. null if < 2 points. */
function stddev(nums: number[]): number | null {
	if (nums.length < 2) return null;
	const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
	const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / (nums.length - 1);
	return Math.round(Math.sqrt(variance));
}

const isDay = (ts: number) => {
	const h = new Date(ts).getHours();
	return h >= 6 && h < 18;
};

/** 24 buckets keyed by local hour. Averages use successful samples only. */
export function aggregateByHour(samples: Sample[]): HourBucket[] {
	const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: 0,
		avgLatency: null,
		avgTtft: null,
		avgTps: null
	}));

	const acc: { lat: number[]; ttft: number[]; tps: number[] }[] = Array.from(
		{ length: 24 },
		() => ({ lat: [], ttft: [], tps: [] })
	);

	for (const s of samples) {
		if (!s.ok) continue;
		const h = new Date(s.ts).getHours();
		buckets[h].count++;
		acc[h].lat.push(s.latencyMs);
		if (s.ttftMs != null) acc[h].ttft.push(s.ttftMs);
		if (s.tokensPerSec != null) acc[h].tps.push(s.tokensPerSec);
	}

	for (let h = 0; h < 24; h++) {
		buckets[h].avgLatency = avg(acc[h].lat);
		buckets[h].avgTtft = avg(acc[h].ttft);
		buckets[h].avgTps = avg(acc[h].tps);
	}
	return buckets;
}

export function summarize(samples: Sample[]): Summary {
	const ok = samples.filter((s) => s.ok);
	const lat = ok.map((s) => s.latencyMs);
	const dayLat = ok.filter((s) => isDay(s.ts)).map((s) => s.latencyMs);
	const nightLat = ok.filter((s) => !isDay(s.ts)).map((s) => s.latencyMs);
	return {
		count: samples.length,
		okCount: ok.length,
		last: samples.length ? samples[samples.length - 1] : null,
		avgLatency: avg(lat),
		p50: percentile(lat, 50),
		p95: percentile(lat, 95),
		p99: percentile(lat, 99),
		jitter: stddev(lat),
		avgTtft: avg(ok.filter((s) => s.ttftMs != null).map((s) => s.ttftMs as number)),
		avgTps: avg(ok.filter((s) => s.tokensPerSec != null).map((s) => s.tokensPerSec as number)),
		errRate: samples.length ? (samples.length - ok.length) / samples.length : null,
		dayAvg: avg(dayLat),
		dayCount: dayLat.length,
		nightAvg: avg(nightLat),
		nightCount: nightLat.length
	};
}
