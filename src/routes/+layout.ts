// Client-only static SPA: prerender the shell, render in the browser.
// Everything depends on localStorage / IndexedDB / fetch, so no SSR.
export const prerender = true;
export const ssr = false;
