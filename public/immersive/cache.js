function reportStatus(callback, state, scope) {
  if (typeof callback !== 'function') return;
  try {
    callback(scope ? { state, scope } : { state });
  } catch {
    // An optional status listener must not affect registration.
  }
}

function isSecureContext(windowRef) {
  if (windowRef.isSecureContext) return true;
  const hostname = windowRef.location?.hostname?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function initOfflineCache({ onStatus } = {}) {
  const windowRef = globalThis.window;
  if (!windowRef) return undefined;

  const serviceWorker = windowRef.navigator?.serviceWorker;
  if (!isSecureContext(windowRef) || typeof serviceWorker?.register !== 'function') {
    reportStatus(onStatus, 'unavailable');
    return undefined;
  }

  const workerUrl = new URL('./sw.js', import.meta.url);
  const scopeUrl = new URL('./', import.meta.url);
  const register = () => {
    let registrationPromise;
    try {
      registrationPromise = serviceWorker.register(workerUrl.href, {
        scope: scopeUrl.pathname,
        updateViaCache: 'none',
      });
    } catch {
      reportStatus(onStatus, 'failed');
      return;
    }

    Promise.resolve(registrationPromise)
      .then(() => reportStatus(onStatus, 'registered', scopeUrl.href))
      .catch(() => reportStatus(onStatus, 'failed'));
  };

  try {
    if (typeof windowRef.requestIdleCallback === 'function') {
      windowRef.requestIdleCallback(register, { timeout: 2000 });
    } else {
      windowRef.setTimeout(register, 0);
    }
  } catch {
    reportStatus(onStatus, 'failed');
  }

  return undefined;
}
