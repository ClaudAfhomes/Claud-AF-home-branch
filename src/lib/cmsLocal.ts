import { documentKeys, validateDocument, type DocumentKey } from "./cmsValidation.ts";

import {
  auditActorName,
  buildAuditRecord,
  documentLabels,
  formatSummaryWithActor,
  isGenericAuditSummary,
  philippineDateBoundary,
  type AuditAction,
  type AuditChange,
} from "./cmsAudit.ts";

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
  action_type: AuditAction;
  change_summary: string;
  change_details?: AuditChange[];
  change_count?: number;
  content_revision?: number;
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
    if (filters.dateFrom && row.saved_at < philippineDateBoundary(filters.dateFrom)) return false;
    if (filters.dateTo && row.saved_at > philippineDateBoundary(filters.dateTo, true)) return false;
    return !search || `${row.key} ${row.change_summary}`.toLowerCase().includes(search);
  }).slice(page * 25, page * 25 + 25).map((row) => {
    const fallbackAudit = row.after_value == null ? undefined : buildAuditRecord(row.key, row.value, row.after_value);
    const genericSummary = isGenericAuditSummary(row.change_summary);
    const actor = auditActorName(undefined, row.saved_by_email, row.saved_by);
    const fallbackSummary = fallbackAudit
      ? formatSummaryWithActor(fallbackAudit.summary, actor)
      : `${actor} updated ${documentLabels[row.key].toLowerCase()}.`;
    return {
      ...row,
      action_type: genericSummary && fallbackAudit ? fallbackAudit.action : row.action_type,
      change_summary: genericSummary ? fallbackSummary : row.change_summary,
      change_details: row.change_details?.length ? row.change_details : fallbackAudit?.changes,
      change_count: row.change_count ?? fallbackAudit?.changeCount,
    };
  });
}
export async function historyValue(id: string) {
  const row = readStore().history.find((item) => item.id === id);
  if (!row) throw new Error("This version is no longer available.");
  return row.value;
}
export async function saveDocuments(
  changes: Partial<Record<DocumentKey, unknown>>,
  changeSummaries: Partial<Record<DocumentKey, string>>,
  changeActions: Partial<Record<DocumentKey, LocalRevision["action_type"]>> = {},
  changeDetails: Partial<Record<DocumentKey, AuditChange[]>> = {},
  changeCounts: Partial<Record<DocumentKey, number>> = {},
) {
  const save = () => {
    const store = readStore();
    for (const key of Object.keys(changes) as DocumentKey[]) {
      const value = validateDocument(key, changes[key]);
      if ((store.versions[key] ?? 0) !== (versions[key] ?? 0)) throw new Error("Content changed in another tab. Reload before saving to avoid overwriting it.");
      const previous = store.documents[key];
      const currentRevision = store.versions[key] ?? 0;
      const contentRevision = currentRevision + 1;
      store.history.unshift({
        id: crypto.randomUUID(),
        key,
        value: previous === undefined ? value : previous,
        after_value: value,
        revision: previous === undefined ? contentRevision : currentRevision,
        content_revision: contentRevision,
        saved_at: new Date().toISOString(),
        saved_by: "local-admin",
        saved_by_email: "Local administrator",
        action_type: changeActions[key] ?? (previous === undefined ? "created" : "updated"),
        change_summary: changeSummaries[key] ?? `Updated ${key}.`,
        change_details: changeDetails[key] ?? [],
        change_count: changeCounts[key] ?? changeDetails[key]?.length ?? 0,
      });
      store.documents[key] = value;
      store.versions[key] = contentRevision;
    }
    store.history = store.history.slice(0, 250);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
    catch { throw new Error("Browser storage is full or unavailable. Export a backup and use smaller images, then try again. Your previous saved content is unchanged."); }
    Object.assign(versions, store.versions);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("afhomes-cms-updated"));
  };
  if (typeof navigator !== "undefined" && navigator.locks) await navigator.locks.request("afhomes-cms-save", save);
  else save();
}
