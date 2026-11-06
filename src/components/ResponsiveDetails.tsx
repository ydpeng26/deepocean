import { useEffect, useState, type ReactNode } from "react";

// Keep desktop content visible; let phone users reveal secondary information.
export function ResponsiveDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setOpen(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <details className="do-responsive-details" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{title}</summary><div>{children}</div>
  </details>;
}
