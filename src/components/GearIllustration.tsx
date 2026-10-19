import type { GearCategory } from "@/lib/gear";

const drawings: Record<GearCategory, string> = {
  bcd: "M23 12 14 20 10 46 18 51 22 37 22 53 42 53 42 37 46 51 54 46 50 20 41 12 37 23 27 23Z M23 31H41 M28 24V49 M36 24V49",
  regulator: "M18 14C42 4 57 22 48 35L42 41 M18 14V23 M12 23H24V34H12Z M28 44A12 12 0 1 0 52 44A12 12 0 1 0 28 44 M35 44H45 M40 39V49",
  computer: "M25 6H39L42 20V44L39 58H25L22 44V20Z M22 22H42 M22 42H42 M27 28H37V36H27Z M46 28V34",
  mask: "M9 25 15 20H49L55 25V40L48 45H39L32 39 25 45H16L9 40Z M14 26H27V37L23 40H17L14 37Z M37 26H50V37L47 40H41L37 37Z M4 27H9 M55 27H60",
  fins: "M14 8H25L27 24 31 53 9 57 12 25Z M39 8H50L52 25 55 57 33 53 37 24Z M17 29 15 49 M23 29 25 48 M41 29 39 48 M47 29 49 49",
  wetsuit: "M24 8 16 13 7 31 15 36 22 24 21 39 18 57H28L32 42 36 57H46L43 39 42 24 49 36 57 31 48 13 40 8 36 15H28Z M32 17V37",
  camera: "M10 23H54V49H10Z M19 23V16H29V23 M38 23V18H46V23 M22 36A10 10 0 1 0 42 36A10 10 0 1 0 22 36 M47 29H49 M5 28V43 M59 28V43",
  other: "M14 17 32 8 50 17V46L32 56 14 46Z M14 17 32 28 50 17 M32 28V56 M23 12 41 23",
};

export function GearIllustration({ category, className = "", label = "" }: { category: GearCategory; className?: string; label?: string }) {
  return <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}><path d={drawings[category] ?? drawings.other} /></svg>;
}
