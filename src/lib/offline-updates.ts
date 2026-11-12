// Register/check in the background. The worker activates a fully cached update
// itself; no banner, controllerchange reload, or access to offline draft storage.
export function watchOfflineUpdates(container: ServiceWorkerContainer): () => void {
  let stopped = false;
  void container
    .register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      if (stopped) return;
      // Failed checks leave the active version intact and must not interrupt forms.
      return registration.update().catch(() => undefined);
    })
    .catch(() => undefined);
  return () => {
    stopped = true;
  };
}
