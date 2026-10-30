// Injected at build time by build.mjs via esbuild define.
// Dev default: http://localhost:8000 (set API_BASE_URL env var for release builds).
declare const __API_BASE__: string;
export const API_BASE = __API_BASE__;
