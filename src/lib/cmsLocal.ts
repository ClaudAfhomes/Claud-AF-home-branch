import { documentKeys, validateDocument, type DocumentKey } from "@/lib/cmsValidation";

const STORAGE_KEY = "afhomes.cms.store.v1";
export interface LocalRevision {
  id: string;
  key: DocumentKey;
  value: unknown;
  after_value?: unknown;
  revision: number;
  saved_at: string;
  saved_by?: string | null;
  saved_by_email?: string | null;
  action_type: "created" | "updated" | "deleted" | "restored" | "published" | "unpublished";
  change_summary: string;
}
interface Store { documents: Partial<Record<DocumentKey, unknown>>; versions: Partial<Record<DocumentKey, number>>; history: LocalRevision[] }
const versions: Partial<Record<DocumentKey, number>> = {};
function readStore(): Store {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as Store;
  const documents: Store["documents"] = {};
  for (const key of documentKeys) {
    const old = localStorage.getItem(`afhomes.cms.${key}`);
    if (old) documents[key] = JSON.parse(old);
  }
  return { documents, versions: {}, history: [] };
}
export function localValue(key: DocumentKey): unknown { return readStore().documents[key]; }
export async function loadDocuments() {
  const store = readStore();
  for (const key of documentKeys) versions[key] = store.versions[key] ?? 0;
}
export interface HistoryFilters { search?: string; key?: string; action?: string; user?: string; dateFrom?: string; dateTo?: string }
export async function listHistory(page: number, filters: HistoryFilters = {}) {
  const search = filters.search?.toLowerCase();
  return readStore().history.filter((row) => {
    if (filters.key && row.key !== filters.key) return false;
    if (filters.action && row.action_type !== filters.action) return false;
    if (filters.user && !(row.saved_by_email ?? row.saved_by ?? "").toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.dateFrom && row.saved_at < `${filters.dateFrom}T00:00:00`) return false;
    if (filters.dateTo && row.saved_at > `${filters.dateTo}T23:59:59.999`) return false;
    return !search || `${row.key} ${row.change_summary}`.toLowerCase().includes(search);
  }).slice(page * 25, page * 25 + 25);
}
export async function historyValue(id: string) {
  const row = readStore().history.find((item) => item.id === id);
  if (!row) throw new Error("This version is no longer available.");
  return row.value;
}
export async function saveDocuments(changes: Partial<Record<DocumentKey, unknown>>, changeSummaries: Partial<Record<DocumentKey, string>>, changeActions: Partial<Record<DocumentKey, LocalRevision["action_type"]>> = {}) {
  const save = () => {
    const store = readStore();
    for (const key of Object.keys(changes) as DocumentKey[]) {
      const value = validateDocument(key, changes[key]);
      if ((store.versions[key] ?? 0) !== (versions[key] ?? 0)) throw new Error("Content changed in another tab. Reload before saving to avoid overwriting it.");
      if (store.documents[key] !== undefined) store.history.unshift({ id: crypto.randomUUID(), key, value: store.documents[key], after_value: value, revision: store.versions[key] ?? 0, saved_at: new Date().toISOString(), saved_by: "local-admin", saved_by_email: "Local administrator", action_type: changeActions[key] ?? "updated", change_summary: changeSummaries[key] ?? "Content updated." });
      store.documents[key] = value;
      store.versions[key] = (store.versions[key] ?? 0) + 1;
    }
    store.history = store.history.slice(0, 10);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { throw new Error("Browser storage is full or unavailable. Export a backup and use smaller images, then try again. Your previous saved content is unchanged."); }
    Object.assign(versions, store.versions);
    window.dispatchEvent(new Event("afhomes-cms-updated"));
  };
  if (navigator.locks) await navigator.locks.request("afhomes-cms-save", save);
  else save();
}
