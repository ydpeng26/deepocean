import { supabase } from "@/integrations/supabase/client";
import type { BuddyRole, DiveType } from "@/lib/dives";

const DATABASE_NAME = "supdiver-offline";
const STORE_NAME = "dive-drafts";

export type OfflineDiveFields = {
  country: string;
  site_name: string;
  dive_date: string;
  weather: string;
  surface_temp: string;
  water_temp: string;
  max_depth: string;
  duration_min: string;
  dive_type: DiveType;
  buddy_role: BuddyRole | "";
  buddy_name: string;
  notes: string;
};

export type OfflineDive = OfflineDiveFields & {
  id: string;
  saved_at: string;
};

export function emptyOfflineDive(): OfflineDiveFields {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return {
    country: "",
    site_name: "",
    dive_date: localDate.toISOString().slice(0, 10),
    weather: "",
    surface_temp: "",
    water_temp: "",
    max_depth: "",
    duration_min: "",
    dive_type: "recreational",
    buddy_role: "",
    buddy_name: "",
    notes: "",
  };
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("此浏览器不支持本机离线存储"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开离线存储"));
    request.onblocked = () => reject(new Error("离线存储正在被其他页面使用，请关闭其他标签页后重试"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let result: T;
    const transaction = db.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? request.error ?? new Error("本机保存失败")); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? request.error ?? new Error("本机保存失败")); };
  });
}

export async function listOfflineDives(): Promise<OfflineDive[]> {
  const drafts = await withStore<OfflineDive[]>("readonly", (store) => store.getAll());
  return drafts.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export async function saveOfflineDive(fields: OfflineDiveFields, existingId?: string): Promise<OfflineDive> {
  const draft: OfflineDive = {
    ...fields,
    country: fields.country.trim().slice(0, 80),
    site_name: fields.site_name.trim().slice(0, 120),
    buddy_name: fields.buddy_name.trim().slice(0, 80),
    notes: fields.notes.trim().slice(0, 2000),
    id: existingId ?? crypto.randomUUID(),
    saved_at: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(draft));
  return draft;
}

export async function deleteOfflineDive(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export async function syncOfflineDives(onProgress?: (done: number, total: number) => void) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("当前没有网络连接，请联网后再同步");
  }
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("请先登录账号再同步离线记录");
  const userId = data.user.id;
  const drafts = await listOfflineDives();
  let synced = 0;
  const failures: string[] = [];

  for (const draft of drafts) {
    const payload = {
      id: draft.id,
      user_id: userId,
      country: draft.country,
      site_name: draft.site_name,
      dive_date: draft.dive_date,
      weather: draft.weather || null,
      surface_temp: optionalNumber(draft.surface_temp),
      water_temp: optionalNumber(draft.water_temp),
      max_depth: optionalNumber(draft.max_depth),
      duration_min: optionalNumber(draft.duration_min),
      dive_type: draft.dive_type,
      buddy_role: draft.buddy_role || null,
      buddy_name: draft.buddy_name || null,
      photo_urls: [],
      notes: draft.notes || null,
    };
    const { error } = await supabase.from("dives").insert(payload);
    if (error) {
      // A previous request may have reached the server even if its response was lost.
      // Only consider a duplicate synced after verifying that it belongs to this account.
      if (error.code !== "23505") {
        failures.push(`${draft.site_name}: ${error.message}`);
        onProgress?.(synced, drafts.length);
        continue;
      }
      const { data: existing, error: lookupError } = await supabase
        .from("dives")
        .select("id, country, site_name, dive_date, weather, surface_temp, water_temp, max_depth, duration_min, dive_type, buddy_role, buddy_name, notes")
        .eq("id", draft.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (lookupError || !existing) {
        failures.push(`${draft.site_name}: 无法确认该记录是否已经同步`);
        onProgress?.(synced, drafts.length);
        continue;
      }
      const comparableFields = [
        "country", "site_name", "dive_date", "weather", "surface_temp", "water_temp",
        "max_depth", "duration_min", "dive_type", "buddy_role", "buddy_name", "notes",
      ] as const;
      if (comparableFields.some((key) => String(existing[key] ?? "") !== String(payload[key] ?? ""))) {
        failures.push(`${draft.site_name}: 云端已有不同内容的记录，请先核对；本机草稿仍保留`);
        onProgress?.(synced, drafts.length);
        continue;
      }
    }
    try {
      await deleteOfflineDive(draft.id);
      synced += 1;
    } catch {
      // Keep the draft if local cleanup fails. Its stable id makes retry safe.
      failures.push(`${draft.site_name}: 已上传，但本机状态未更新，请重试`);
    }
    onProgress?.(synced, drafts.length);
  }
  return { synced, total: drafts.length, failures };
}
