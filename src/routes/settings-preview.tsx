import { createFileRoute, redirect } from "@tanstack/react-router";

// Retire the mock score/devices/privacy/export switches. Old links now lead to
// the real authenticated account page instead of a simulated security screen.
export const Route = createFileRoute("/settings-preview")({
  beforeLoad: () => {
    throw redirect({ to: "/settings", replace: true });
  },
});
