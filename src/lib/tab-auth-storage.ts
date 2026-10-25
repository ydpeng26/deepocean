type TabStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type AuthStorageStatus = "checking" | "available" | "blocked";

export class AuthStorageUnavailable extends Error {
  constructor() {
    super(
      "登录存储暂不可用，请恢复网站存储权限后重试。 / Session storage unavailable. Allow site storage, then retry.",
    );
    this.name = "AuthStorageUnavailable";
  }
}

// No memory-token or localStorage fallback. A failed optional read can initialize
// the SDK as signed out, but auth writes remain explicitly unavailable.
export function createTabAuthStorage(getStorage: () => TabStorage) {
  let status: AuthStorageStatus = "checking";
  const listeners = new Set<() => void>();
  const probe = `supdiver:session-probe:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let probeOwned = false;
  function publish(next: AuthStorageStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((listener) => listener());
  }
  function retry() {
    let storage: TabStorage | undefined;
    let written = false;
    try {
      storage = getStorage();
      if (probeOwned) {
        storage.removeItem(probe);
        probeOwned = false;
      }
      if (storage.getItem(probe) !== null) throw new AuthStorageUnavailable();
      storage.setItem(probe, "1");
      written = true;
      probeOwned = true;
      if (storage.getItem(probe) !== "1") throw new AuthStorageUnavailable();
      storage.removeItem(probe);
      probeOwned = false;
      publish("available");
      return true;
    } catch {
      if (written) {
        try {
          storage?.removeItem(probe);
          probeOwned = false;
        } catch {
          /* Only our own probe. */
        }
      }
      publish("blocked");
      return false;
    }
  }
  const storage: TabStorage = {
    getItem(key) {
      if (status !== "available") return null;
      try {
        return getStorage().getItem(key);
      } catch {
        publish("blocked");
        return null;
      }
    },
    setItem(key, value) {
      if (status !== "available") throw new AuthStorageUnavailable();
      try {
        getStorage().setItem(key, value);
      } catch {
        publish("blocked");
        throw new AuthStorageUnavailable();
      }
    },
    removeItem(key) {
      if (status !== "available") return;
      try {
        getStorage().removeItem(key);
      } catch {
        publish("blocked"); /* Cannot promise removal while browser denies it. */
      }
    },
  };
  retry();
  return {
    storage,
    retry,
    getSnapshot: () => status,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

let browserStorage: ReturnType<typeof createTabAuthStorage> | undefined;
let status: AuthStorageStatus = "checking";
let revision = 0;
const listeners = new Set<() => void>();
function update() {
  status = browserStorage?.getSnapshot() ?? "checking";
  ++revision;
  listeners.forEach((listener) => listener());
}
export function getTabAuthStorage() {
  if (typeof window === "undefined") return undefined;
  if (!browserStorage) {
    browserStorage = createTabAuthStorage(() => window.sessionStorage);
    browserStorage.subscribe(update);
    update();
  }
  return browserStorage.storage;
}
export const authStorageState = {
  getSnapshot: () => status,
  getRevision: () => revision,
  getServerSnapshot: (): AuthStorageStatus => "checking",
  subscribe(listener: () => void) {
    listeners.add(listener);
    getTabAuthStorage();
    return () => {
      listeners.delete(listener);
    };
  },
  retry() {
    getTabAuthStorage();
    return browserStorage?.retry() ?? false;
  },
};
export function authStorageAvailable(recheck = false) {
  getTabAuthStorage();
  if (recheck) return browserStorage?.retry() ?? false;
  return status === "available";
}
