import { useSyncExternalStore } from "react";
import { authStorageState } from "@/lib/tab-auth-storage";

export function useAuthStorageStatus() {
  return useSyncExternalStore(
    authStorageState.subscribe,
    authStorageState.getSnapshot,
    authStorageState.getServerSnapshot,
  );
}
