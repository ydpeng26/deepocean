import { useEffect } from "react";
import { watchOfflineUpdates } from "@/lib/offline-updates";

// Kept at the root so registration survives route changes. Updates have no UI
// and never refresh an open editor or touch its saved/unsaved drafts.
export function OfflineUpdateNotice() {
  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      return watchOfflineUpdates(navigator.serviceWorker);
    }
  }, []);
  return null;
}
