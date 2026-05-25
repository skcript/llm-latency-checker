import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Cloudflare Pages. Output is a static SPA (see +layout.ts: prerender + ssr=false).
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<files>', '/_app/*']
			}
		})
	}
};

export default config;
