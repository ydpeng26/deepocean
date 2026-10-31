export type DiveCompanion = { name: string; role: "buddy" | "guide" | "instructor" | null };
type Source = { companions?: DiveCompanion[] | null; buddy_name?: string | null; buddy_role?: string | null };

export function readCompanions(source?: Source): DiveCompanion[] {
  if (source?.companions != null) return source.companions.map(person => ({ name: person.name, role: person.role }));
  if (!source?.buddy_name?.trim()) return [];
  return [{ name: source.buddy_name, role: source.buddy_role === "instructor" ? "instructor" : source.buddy_role === "buddy" ? "buddy" : null }];
}

export function normalizeCompanions(people: readonly DiveCompanion[]): DiveCompanion[] {
  return people.filter(person => person.name.trim()).map(person => {
    const name = person.name.trim();
    if (name.length > 80 || ![null, "buddy", "guide", "instructor"].includes(person.role)) {
      throw new Error("请检查潜伴姓名和身份 / Check companion name and role");
    }
    return { name, role: person.role };
  });
}

export function companionFields(people: readonly DiveCompanion[]) {
  const companions = normalizeCompanions(people);
  const first = companions[0];
  return {
    companions,
    // Retain the first person's legacy fields for older readers.
    buddy_name: first?.name ?? null,
    buddy_role: first?.role === "guide" ? "instructor" as const : first?.role ?? null,
  };
}

export function companionsText(source: Source, english = false) {
  const labels = english
    ? { buddy: "Buddy", guide: "Guide", instructor: "Instructor" }
    : { buddy: "潜伴", guide: "向导", instructor: "教练" };
  return readCompanions(source).map(person => person.role ? `${labels[person.role]}：${person.name}` : person.name).join("；") || "—";
}
