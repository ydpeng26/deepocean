import type { DiveCompanion } from "@/lib/dive-companions";

export function DiveCompanionsEditor({ value, onChange, english = false }: {
  value: DiveCompanion[];
  onChange: (value: DiveCompanion[]) => void;
  english?: boolean;
}) {
  const update = (index: number, patch: Partial<DiveCompanion>) =>
    onChange(value.map((person, i) => i === index ? { ...person, ...patch } : person));
  return <div className="space-y-3 sm:col-span-full">
    <p className="text-sm">{english ? "Buddies, guides and instructors" : "潜伴、向导与教练"}</p>
    {value.map((person, index) => <div key={index} className="flex flex-wrap items-center gap-2">
      <select className="h-10 rounded-none border border-input bg-background px-2 text-sm"
        aria-label={`${english ? "Role" : "身份"} ${index + 1}`} value={person.role ?? ""}
        onChange={e => update(index, { role: (e.target.value || null) as DiveCompanion["role"] })}>
        <option value="">{english ? "Unspecified" : "未指定"}</option>
        <option value="buddy">{english ? "Buddy" : "潜伴"}</option>
        <option value="guide">{english ? "Guide" : "向导"}</option>
        <option value="instructor">{english ? "Instructor" : "教练"}</option>
      </select>
      <input className="h-10 min-w-0 flex-1 rounded-none border border-input bg-background px-3 text-sm"
        aria-label={`${english ? "Name" : "姓名"} ${index + 1}`} placeholder={english ? "Name" : "姓名"}
        maxLength={80} value={person.name} onChange={e => update(index, { name: e.target.value })} />
      <button type="button" className="px-2 py-2 text-sm" aria-label={`${english ? "Remove person" : "移除人员"} ${index + 1}`}
        onClick={() => onChange(value.filter((_, i) => i !== index))}>{english ? "Remove" : "移除"}</button>
    </div>)}
    <button type="button" className="border border-input px-3 py-2 text-sm"
      onClick={() => onChange([...value, { name: "", role: "buddy" }])}>
      {english ? "+ Add person" : "+ 添加人员"}
    </button>
  </div>;
}
