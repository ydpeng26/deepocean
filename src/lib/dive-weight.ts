export function diveWeightFields(value: string | undefined, unit: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return { weight_value: null, weight_unit: null };
  if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(Number(raw)) || Number(raw) > 9999.99 || !["kg", "lb"].includes(unit ?? "kg"))
    throw new Error("配重须为 0–9999.99 的数字，单位为 kg 或 lb / Enter a valid weight and unit");
  return { weight_value: Number(raw), weight_unit: (unit ?? "kg") as "kg" | "lb" };
}
