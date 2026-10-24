(() => {
  const applicationBase = new URL('./', window.location.href);
  const destination = new URL('immersive/', applicationBase);
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  if (window.isSecureContext && window.navigator.serviceWorker) {
    void window.navigator.serviceWorker.register(new URL('sw.js', applicationBase).href, {
      scope: applicationBase.pathname,
      updateViaCache: 'none',
    }).catch(() => undefined);
  }
  window.location.replace(destination.href);
})();
