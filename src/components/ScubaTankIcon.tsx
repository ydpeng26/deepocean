import type { ComponentPropsWithoutRef } from "react";

export function ScubaTankIcon({ className, ...props }: ComponentPropsWithoutRef<"svg">) {
  return <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M9 5V3h6v2" />
    <path d="M10.5 3V1.5h3V3" />
    <path d="M9 5c-2 .9-3 2.5-3 4.5V18a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V9.5c0-2-1-3.6-3-4.5" />
    <path d="M6 10h12M6 16h12" />
  </svg>;
}
