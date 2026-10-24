// Observe readiness only. Never message skipWaiting or reload a live editor.
export function watchOfflineUpdates(
  container: ServiceWorkerContainer,
  onReady: () => void,
): () => void {
  let stopped = false;
  let notified = false;
  const notify = () => {
    if (!stopped && !notified) {
      notified = true;
      onReady();
    }
  };
  const cleanups: Array<() => void> = [];
  container
    .register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      if (stopped) return;
      const ready = () => {
        if (container.controller && registration.waiting) notify();
      };
      const observeInstalling = () => {
        const worker = registration.installing;
        if (!worker) return;
        const changed = () => {
          if (worker.state === "installed" && container.controller) notify();
        };
        worker.addEventListener("statechange", changed);
        cleanups.push(() => worker.removeEventListener("statechange", changed));
        changed();
      };
      registration.addEventListener("updatefound", observeInstalling);
      cleanups.push(() => registration.removeEventListener("updatefound", observeInstalling));
      ready();
      observeInstalling();
      // A failed background check must not break offline editing or create an
      // unhandled rejection. Installation itself remains atomic in the worker.
      void registration.update().catch(() => undefined);
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
    cleanups.forEach((cleanup) => cleanup());
  };
}
