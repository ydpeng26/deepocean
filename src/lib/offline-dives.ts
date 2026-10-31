import { readCompanions, companionFields, normalizeCompanions, type DiveCompanion } from "@/lib/dive-companions";
import { supabase } from "@/integrations/supabase/client";
import type { BuddyRole, DiveType } from "@/lib/dives";
import { parseDiveEntryTime } from "@/lib/dive-order";

const DATABASE_NAME = "supdiver-offline";
const STORE_NAME = "dive-drafts";

export type OfflineDiveFields = {
  country: string;
  region: string;
  site_name: string;
  dive_date: string;
  entry_time?: string;
  weather: string;
  surface_temp: string;
  water_temp: string;
  max_depth: string;
  duration_min: string;
  dive_type: DiveType;
  buddy_role: BuddyRole | "";
  buddy_name: string;
  companions?: DiveCompanion[] | null;
  notes: string;
};

export type OfflineDive = OfflineDiveFields & {
  id: string;
  saved_at: string;
  revision?: string;
};

export class OfflineDraftConflict extends Error {
  constructor() {
    super(
      "草稿已被其他页面修改、删除或同步，请保留输入后重新读取，或另存为新草稿 / Draft changed or was removed elsewhere. Keep your input, then reload or save as new.",
    );
    this.name = "OfflineDraftConflict";
  }
}

function sameDraft(a: OfflineDive | undefined, b: OfflineDive) {
  return (
    !!a &&
    a.id === b.id &&
    a.saved_at === b.saved_at &&
    a.revision === b.revision &&
    sameFields(a, b)
  );
}

function sameFields(a: OfflineDiveFields, b: OfflineDiveFields) {
  return (Object.keys(emptyOfflineDive()) as (keyof OfflineDiveFields)[]).every(
    (key) => key === "companions" ? JSON.stringify(readCompanions(a)) === JSON.stringify(readCompanions(b)) : key === "entry_time" ? (a[key] ?? "") === (b[key] ?? "") : a[key] === b[key],
  );
}

// Read, compare and write in ONE transaction; another tab cannot interleave.
async function changeDraft<T>(
  id: string,
  operation: (current: OfflineDive | undefined, store: IDBObjectStore) => T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const read = store.get(id);
    let result: T;
    let failure: unknown;
    read.onsuccess = () => {
      try {
        result = operation(read.result, store);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure ?? tx.error ?? new Error("本机保存失败"));
    };
  });
}

export function emptyOfflineDive(): OfflineDiveFields {
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60_000);
  return {
    country: "",
    region: "",
    site_name: "",
    dive_date: localDate.toISOString().slice(0, 10),
    entry_time: "",
    weather: "",
    surface_temp: "",
    water_temp: "",
    max_depth: "",
    duration_min: "",
    dive_type: "recreational",
    buddy_role: "",
    buddy_name: "",
    companions: null,
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
    request.onblocked = () =>
      reject(new Error("离线存储正在被其他页面使用，请关闭其他标签页后重试"));
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
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => transaction.abort();
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("本机保存失败"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? request.error ?? new Error("本机保存失败"));
    };
  });
}

export async function listOfflineDives(): Promise<OfflineDive[]> {
  const drafts = await withStore<OfflineDive[]>("readonly", (store) => store.getAll());
  return drafts.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

export async function saveOfflineDive(
  fields: OfflineDiveFields,
  existingId?: string,
  options: { expected?: OfflineDive; requestId?: string } = {},
): Promise<OfflineDive> {
  const draft: OfflineDive = {
    ...fields,
    companions: normalizeCompanions(readCompanions(fields)),
    entry_time: parseDiveEntryTime(fields.entry_time)?.slice(0, 5) ?? "",
    country: fields.country.trim().slice(0, 80),
    region: fields.region.trim().slice(0, 100),
    site_name: fields.site_name.trim().slice(0, 120),
    buddy_name: fields.buddy_name.trim().slice(0, 80),
    notes: fields.notes.trim().slice(0, 2000),
    id: existingId ?? options.requestId ?? crypto.randomUUID(),
    saved_at: new Date().toISOString(),
    revision: crypto.randomUUID(),
  };
  return changeDraft(draft.id, (current, store) => {
    if (existingId) {
      if (!options.expected || options.expected.id !== existingId || !current)
        throw new OfflineDraftConflict();
      if (!sameDraft(current, options.expected)) {
        if (sameFields(current, draft)) return current; // Idempotent lost-local-reply retry.
        throw new OfflineDraftConflict();
      }
    } else if (current) {
      if (sameFields(current, draft)) return current;
      throw new OfflineDraftConflict();
    }
    store.put(draft);
    return draft;
  });
}

export async function deleteOfflineDive(id: string, expected?: OfflineDive): Promise<void> {
  await changeDraft(id, (current, store) => {
    if (!expected || !sameDraft(current, expected)) throw new OfflineDraftConflict();
    store.delete(id);
  });
}

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

type SyncOptions = {
  selectedIds?: string[];
  expectedUserId?: string;
  isCurrent?: () => boolean;
};
let syncInProgress = false;
export class OfflineSyncBusy extends Error {
  constructor() {
    super("另一个页面正在同步，请等待完成后重新核对草稿");
    this.name = "OfflineSyncBusy";
  }
}

export async function syncOfflineDives(
  onProgress?: (done: number, total: number) => void,
  options: SyncOptions = {},
) {
  if (syncInProgress) throw new OfflineSyncBusy();
  syncInProgress = true;
  try {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request(
        "supdiver-offline-sync",
        { mode: "exclusive", ifAvailable: true },
        (lock) => {
          if (!lock) throw new OfflineSyncBusy();
          return performSync(onProgress, options);
        },
      );
    }
    return await performSync(onProgress, options);
  } finally {
    syncInProgress = false;
  }
}

async function performSync(
  onProgress: ((done: number, total: number) => void) | undefined,
  options: SyncOptions,
) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("当前没有网络连接，请联网后再同步");
  }
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) throw new Error("请先登录账号再同步离线记录");
  const userId = data.user.id;
  if (options.expectedUserId && options.expectedUserId !== userId) {
    throw new Error("登录账号已变化，请重新确认同步账号");
  }
  let accountChanged = false;
  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== userId) accountChanged = true;
  });
  function assertCurrent() {
    if (accountChanged || options.isCurrent?.() === false) {
      throw new Error("同步账号或页面已变化，任务已停止；请重新核对云端记录与本机草稿");
    }
  }
  async function checkAccount() {
    assertCurrent();
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId) accountChanged = true;
    assertCurrent();
  }
  try {
    const selected = options.selectedIds ? new Set(options.selectedIds) : null;
    const drafts = (await listOfflineDives()).filter(
      (draft) => !selected || selected.has(draft.id),
    );
    let synced = 0;
    const failures: string[] = [];

    for (const draft of drafts) {
      await checkAccount();
      const payload = {
        id: draft.id,
        user_id: userId,
        country: draft.country,
        region: draft.region || null,
        site_name: draft.site_name,
        dive_date: draft.dive_date,
        entry_time: parseDiveEntryTime(draft.entry_time),
        weather: draft.weather || null,
        surface_temp: optionalNumber(draft.surface_temp),
        water_temp: optionalNumber(draft.water_temp),
        max_depth: optionalNumber(draft.max_depth),
        duration_min: optionalNumber(draft.duration_min),
        dive_type: draft.dive_type,
        ...companionFields(readCompanions(draft)),
        photo_urls: [],
        photo_thumbnail_urls: [],
        notes: draft.notes || null,
      };
      const { error } = await supabase.from("dives").insert(payload);
      await checkAccount();
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
          .select(
            "id, country, region, site_name, dive_date, entry_time, weather, surface_temp, water_temp, max_depth, duration_min, dive_type, buddy_role, buddy_name, companions, notes",
          )
          .eq("id", draft.id)
          .eq("user_id", userId)
          .maybeSingle();
        await checkAccount();
        if (lookupError || !existing) {
          failures.push(`${draft.site_name}: 无法确认该记录是否已经同步`);
          onProgress?.(synced, drafts.length);
          continue;
        }
        const comparableFields = [
          "country",
          "region",
          "site_name",
          "dive_date",
          "entry_time",
          "weather",
          "surface_temp",
          "water_temp",
          "max_depth",
          "duration_min",
          "dive_type",
          "buddy_role",
          "buddy_name",
          "notes",
        ] as const;
        if (
          JSON.stringify(readCompanions(existing as unknown as OfflineDiveFields)) !== JSON.stringify(payload.companions) ||
          comparableFields.some((key) => String(existing[key] ?? "") !== String(payload[key] ?? ""))
        ) {
          failures.push(`${draft.site_name}: 云端已有不同内容的记录，请先核对；本机草稿仍保留`);
          onProgress?.(synced, drafts.length);
          continue;
        }
      }
      try {
        await checkAccount();
        const cleanup = await deleteSyncedDraft(draft, assertCurrent);
        assertCurrent();
        if (cleanup === "changed") {
          failures.push(`${draft.site_name}: 同步期间本机内容已修改，请核对云端记录；新草稿仍保留`);
          continue;
        }
        synced += 1;
      } catch {
        assertCurrent();
        // Keep the draft if local cleanup fails. Its stable id makes retry safe.
        failures.push(`${draft.site_name}: 已上传，但本机状态未更新，请重试`);
      }
      onProgress?.(synced, drafts.length);
    }
    return { synced, total: drafts.length, failures };
  } finally {
    authListener.subscription.unsubscribe();
  }
}

// Another tab may edit a draft while the upload is in flight. Only remove the
// exact version that was sent; an updated local entry must never be discarded.
async function deleteSyncedDraft(
  draft: OfflineDive,
  assertCurrent: () => void,
): Promise<"removed" | "absent" | "changed"> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let result: "removed" | "absent" | "changed" = "changed";
    let failure: unknown;
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const read = store.get(draft.id);
    read.onsuccess = () => {
      try {
        assertCurrent();
        // Only reached after confirming this exact payload in the intended cloud
        // account. Another tab may already have completed the same local cleanup.
        if (read.result === undefined) result = "absent";
        if (JSON.stringify(read.result) === JSON.stringify(draft)) {
          store.delete(draft.id);
          result = "removed";
        }
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(failure ?? tx.error ?? new Error("本机状态未更新"));
    };
  });
}
