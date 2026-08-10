// src/app/core/utils/chunk-reload.util.ts

const LAST_RELOAD_KEY = 'eduxo:lastChunkReload';
const REDIRECT_KEY = 'eduxo:redirectAfterReload';
const RELOAD_GUARD_MS = 15_000; // don't reload-loop if the deploy is genuinely broken

const CHUNK_ERROR_PATTERNS = [
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /Loading chunk .* failed/i,
    /ChunkLoadError/i,
];

export function isChunkLoadError(err: unknown): boolean {
    const message = (err as { message?: string })?.message ?? String(err ?? '');
    return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function reloadForChunkError(targetUrl?: string): void {
    if (typeof sessionStorage === 'undefined') return;

    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) ?? 0);
    const now = Date.now();

    if (now - last < RELOAD_GUARD_MS) {
        console.error('[ChunkReload] Failed twice within 15s — deployment may be broken. Not reloading again.');
        return;
    }

    sessionStorage.setItem(LAST_RELOAD_KEY, String(now));
    if (targetUrl) {
        sessionStorage.setItem(REDIRECT_KEY, targetUrl);
    }
    location.reload();
}

/** Call once, on app init, to finish the navigation the user originally wanted. */
export function consumePendingChunkRedirect(): string | null {
    if (typeof sessionStorage === 'undefined') return null; // SSR — nothing pending yet
    
    const redirect = sessionStorage.getItem(REDIRECT_KEY);
    if (redirect) sessionStorage.removeItem(REDIRECT_KEY);
    return redirect;
}