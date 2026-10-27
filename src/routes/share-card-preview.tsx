import { createFileRoute, redirect } from "@tanstack/react-router";

// The historical mock is replaced by the protected, real-data editor.
export const Route = createFileRoute("/share-card-preview")({
  beforeLoad: () => {
    throw redirect({ to: "/share-card", replace: true });
  },
});
