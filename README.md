# LLM Latency Dashboard

> A project from the **[R&E (Research & Engineering) Group](https://www.skcript.com)** at **[Skcript](https://www.skcript.com)**.

A client-only dashboard that measures how fast LLMs respond — **total latency**, **time-to-first-token (TTFT)**, and **tokens/sec** — bucketed by **hour of day**, so you can see how response times shift across day and night.

Amber-CRT terminal aesthetic. Your API keys are stored **only in your browser** (`localStorage`) and sent straight to the provider — there is no backend.

## Features

- **Pluggable providers** — Gemini (default), OpenAI, Anthropic built in, plus **custom OpenAI-compatible endpoints** (Groq, OpenRouter, Together, Mistral, DeepSeek, xAI, Ollama, LM Studio, vLLM…).
- **Multi-provider benchmark** — select 2+ providers and ping them simultaneously on the same prompt; compare head-to-head.
- **Three metrics per ping** — total latency, TTFT, throughput — from real streaming responses.
- **Rich stats** — avg, p50, p95, p99, jitter (σ), error rate, day-vs-night split.
- **ASCII charts** — hour-of-day bars + live latency sparkline, pure text (no canvas).
- **Key check** — validate a key with one tiny request before measuring.
- **Skew guard** — skips pings when the device sleeps / throttles, so latency data stays clean.
- **Retention cap** — samples pruned to the last 5,000 (IndexedDB); keys + settings in localStorage.
- **Export** — download all samples as JSON or CSV.
- **Keyboard-driven** — `[s]tart [p]ing [c]fg [x]clear [t]oggle`.

## How it works

The browser fires a streaming request to each selected provider on an interval and records:

| Metric | Measured |
|---|---|
| Total latency | request sent → stream fully read |
| TTFT | request sent → first token received |
| Tokens/sec | output tokens ÷ generation time (after first token) |

All providers support direct browser calls (Anthropic requires the `anthropic-dangerous-direct-browser-access` header, set automatically).

> **Coverage note:** measurement runs only while the tab is open. To capture true day/night data, keep the tab open ~24h. For unattended 24/7 collection you'd add a Cloudflare Worker with a Cron Trigger + D1 — intentionally out of scope to keep this client-only.

## Develop

```bash
bun install
bun run dev
```

## Build & deploy (Cloudflare Pages)

```bash
bun run build          # outputs .svelte-kit/cloudflare
bun run deploy         # wrangler pages deploy (set --project-name in package.json)
```

Or connect the repo in the Cloudflare Pages dashboard:
- **Build command:** `bun run build`
- **Output directory:** `.svelte-kit/cloudflare`

## Adding a provider

Two ways:
1. **In the UI** — open `[cfg]` → Custom LLMs → add an OpenAI-compatible base URL + model + key (presets provided).
2. **In code** — for a non-OpenAI wire format, add `src/lib/providers/<name>.ts` implementing the `Provider` interface (`types.ts`) and register it in `src/lib/providers/index.ts`. Reuse the shared helpers in `sse.ts` (`readSSE`, `throughput`, `failResult`, `errMsg`).

## Stack

SvelteKit 5 · Tailwind 4 · `@sveltejs/adapter-cloudflare` · Bun. Amber-CRT TUI with pure-text ASCII charts. Logomark + type from the Skcript Svelte DL.

## License

MIT — see [LICENSE](./LICENSE). From the R&E Group at [Skcript](https://www.skcript.com).
