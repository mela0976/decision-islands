const MAX_SEED_URLS = 80;

type IdleWindow = Omit<Window, 'requestIdleCallback'> & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

function scheduleIdle(win: IdleWindow, callback: () => void): void {
  if (win.requestIdleCallback) {
    win.requestIdleCallback(callback, { timeout: 2000 });
  } else {
    win.setTimeout(callback, 0);
  }
}

function cachePriority(pathname: string): number | null {
  if (/\/$|\/index\.html?$/i.test(pathname)) return 0;
  if (/\/data\/[^/]+\.json$/i.test(pathname)) return 1;
  if (/(?:-|\.)[A-Za-z0-9_-]{8,}\.(?:js|css)$/i.test(pathname)) return 2;
  if (/\/fonts\/[^/]+\.css$/i.test(pathname) || /\.(?:woff2?|ttf|otf)$/i.test(pathname)) return 3;
  if (/\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(pathname)) return 4;
  return null;
}

function loadedResourceUrls(win: IdleWindow, scopeUrl: URL): string[] {
  const candidates = new Set<string>([win.location.href]);
  for (const entry of win.performance.getEntriesByType('resource')) {
    if ('name' in entry && typeof entry.name === 'string') candidates.add(entry.name);
  }
  for (const element of win.document.querySelectorAll<HTMLScriptElement | HTMLLinkElement | HTMLImageElement>(
    'script[src], link[rel="stylesheet"], link[rel="modulepreload"], img[src]',
  )) {
    const resourceUrl = 'src' in element ? element.src : element.href;
    if (resourceUrl) candidates.add(resourceUrl);
  }

  const urls: Array<{ href: string; priority: number; order: number }> = [];
  let order = 0;
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate, win.location.href);
      if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) continue;
      const priority = cachePriority(url.pathname);
      if (priority === null) continue;
      url.hash = '';
      if (!urls.some(resource => resource.href === url.href)) urls.push({ href: url.href, priority, order: order++ });
    } catch { /* Ignore malformed performance entries. */ }
  }
  return urls.sort((a, b) => a.priority - b.priority || a.order - b.order).slice(0, MAX_SEED_URLS).map(resource => resource.href);
}

/** Start same-origin offline caching without delaying initial rendering. */
export function initializeBrowserCache(): void {
  initializeBrowserCacheAtBase(import.meta.env.BASE_URL);
}

/** Exposed so relative-base registration can be checked without a Vite build. */
export function initializeBrowserCacheAtBase(baseUrl: string): void {
  try {
    const win = globalThis.window as IdleWindow | undefined;
    if (!win) return;
    const localHost = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(win.location.hostname);
    if (!win.isSecureContext && !localHost) return;
    const serviceWorker = win.navigator.serviceWorker;
    if (!serviceWorker) return;

    const scopeUrl = new URL(baseUrl || './', win.location.href);
    const scriptUrl = new URL('sw.js', scopeUrl);
    const start = (): void => {
      void serviceWorker.register(scriptUrl.href, { scope: scopeUrl.pathname, updateViaCache: 'none' })
        .then(async registration => {
          const readyRegistration = await serviceWorker.ready;
          const activeWorker = readyRegistration.active ?? registration.active;
          if (!activeWorker) return;
          activeWorker.postMessage({ type: 'seed-cache-resources', urls: loadedResourceUrls(win, scopeUrl) });
        })
        .catch(() => { /* Offline support is optional; never interrupt reading. */ });
    };

    if (win.document.readyState === 'complete') scheduleIdle(win, start);
    else win.addEventListener('load', () => scheduleIdle(win, start), { once: true });
  } catch {
    // Unsupported, insecure, or storage-restricted browsers continue online normally.
  }
}
