import { useEffect, useState } from "react";
import { cmsRepository, listHistory, restoreHistorySnapshot, saveDocuments } from "@/lib/cms";
import { backupSchema, documentKeys, type DocumentKey } from "@/lib/cmsValidation";
import {
  changeStatusLabel,
  displayAuditValue,
  documentLabels,
  formatPhilippineDateTime,
  isImageSrcChange,
  previewableImageSrc,
  sanitizeAuditValue,
  type AuditAction,
  type AuditChange,
} from "@/lib/cmsAudit";
import { hasSupabaseConfig } from "@/lib/supabase";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SmartImage } from "@/components/ui/SmartImage";
import { confirmAction, showToast } from "@/lib/dialog";
import type { LocalRevision } from "@/lib/cmsLocal";

const actions: AuditAction[] = ["created", "updated", "deleted", "archived", "restored", "published", "unpublished"];
const actionTones: Record<AuditAction, "leaf" | "cyan" | "coral" | "gold" | "magenta" | "neutral"> = {
  created: "leaf",
  updated: "cyan",
  deleted: "coral",
  archived: "gold",
  restored: "magenta",
  published: "leaf",
  unpublished: "gold",
};

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function contentBackup() {
  return {
    format: "afhomes-cms",
    version: 1,
    createdAt: new Date().toISOString(),
    documents: {
      site: cmsRepository.getSiteConfig(),
      pageContent: cmsRepository.getPageContent(),
      experiences: cmsRepository.getAllExperiences(),
      vip: cmsRepository.getAllVipPlans(),
      faq: cmsRepository.getAllFaqCategories(),
      stories: cmsRepository.getAllStories(),
      mediaBlocks: cmsRepository.getMediaBlocks(),
    },
  };
}

function actorLabel(row: LocalRevision) {
  return row.saved_by_email || row.saved_by || "Administrator";
}

function ImageCell({ value, change }: { value: unknown; change: AuditChange }) {
  const src = previewableImageSrc(value);
  const label = displayAuditValue(value, change);
  if (!src) {
    return <p>{label}</p>;
  }
  return (
    <div className="space-y-2">
      <SmartImage
        spec={{ src, alt: "Audit history image preview" }}
        className="h-16 w-24 overflow-hidden rounded-md ring-1 ring-line"
        sizes="96px"
      />
      <p className="text-ink-500">{label}</p>
    </div>
  );
}

function ValueCell({ value, change }: { value: unknown; change: AuditChange }) {
  if (isImageSrcChange(change) || (change.value_type === "image" && typeof value === "string")) {
    return <ImageCell value={value} change={change} />;
  }
  if (change.operation === "created" && (value === undefined || value === null)) return <span>Added</span>;
  if (change.operation === "deleted" && (value === undefined || value === null)) return <span>Removed</span>;
  return <span className="break-words">{displayAuditValue(value, change)}</span>;
}

function HistoryRow({ row, busy, onRestore }: { row: LocalRevision; busy: boolean; onRestore: () => void }) {
  const details = row.change_details ?? [];
  const extra = Math.max(0, (row.change_count ?? details.length) - details.length);
  return (
    <article className="rounded-xl border border-line bg-cream-50 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={actionTones[row.action_type] ?? "neutral"} className="capitalize">{row.action_type}</Badge>
            <Badge>{documentLabels[row.key]}</Badge>
          </div>
          <p className="mt-3 font-semibold text-navy-900">{row.change_summary}</p>
          <p className="mt-1 text-xs text-ink-400">
            {actorLabel(row)}
            {" · "}
            Version {row.content_revision ?? row.revision + 1}
            {" · Snapshot v"}
            {row.revision}
          </p>
        </div>
        <time className="shrink-0 text-sm text-ink-500" dateTime={row.saved_at}>{formatPhilippineDateTime(row.saved_at)}</time>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-pine-800">View details</summary>
        <div className="mt-4 overflow-x-auto">
          {details.length ? (
            <table className="w-full min-w-[38rem] text-left text-xs">
              <thead>
                <tr className="text-ink-400">
                  <th className="pb-2 pr-4">Changed item</th>
                  <th className="pb-2 pr-4">Previous value</th>
                  <th className="pb-2">New value</th>
                </tr>
              </thead>
              <tbody>
                {details.map((change) => (
                  <tr key={`${change.path}-${change.operation}`} className="border-t border-line align-top">
                    <th className="py-3 pr-4 font-semibold text-ink-700">
                      <p>{change.label}</p>
                      <p className="mt-1 font-medium text-ink-400">{changeStatusLabel(change)}</p>
                    </th>
                    <td className="py-3 pr-4 text-ink-500"><ValueCell value={change.before} change={change} /></td>
                    <td className="py-3 text-ink-700"><ValueCell value={change.after} change={change} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-500">No field-level details were stored for this older history row. The restore snapshot is still available.</p>
          )}
          {extra > 0 && <p className="mt-3 text-sm text-ink-500">{extra} additional changes were recorded.</p>}
        </div>
        <details className="mt-4 rounded-lg bg-cream-100 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-pine-800">Preview restore snapshot</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-ink-600">
            {JSON.stringify(sanitizeAuditValue(row.value), null, 2)}
          </pre>
        </details>
        <Button disabled={busy} variant="outline" size="sm" className="mt-4" onClick={onRestore}>
          Restore this version
        </Button>
      </details>
    </article>
  );
}

export function BackupPanel() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [key, setKey] = useState("");
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, loading, error, retry } = useAsync(() => listHistory(page, { search, key, action, user, dateFrom, dateTo }), [page, search, key, action, user, dateFrom, dateTo]);
  useEffect(() => {
    if (!notice) return;
    void showToast(notice, /failed|error|unable|invalid|must/i.test(notice) ? "error" : "success");
  }, [notice]);
  const run = async (work: () => Promise<void>, success = "Content saved successfully.") => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await work();
      setNotice(success);
      retry();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  };
  const resetFilters = () => {
    setSearch("");
    setKey("");
    setAction("");
    setUser("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };
  return (
    <section className="space-y-7 rounded-2xl border border-line bg-cream-50 p-5 shadow-soft sm:p-8">
      <header className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="label-caps text-leaf-700">Audit trail & recovery</p>
          <h2 className="font-display mt-1 text-4xl text-navy-900">Change History / Restore</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            See exactly what changed, who changed it, and when. Restore a previous snapshot without deleting history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadJson(contentBackup(), "afhomes-content-backup.json")}>Download backup</Button>
          <label className="cursor-pointer rounded-full border border-line px-5 py-3 text-sm font-semibold">
            Restore backup
            <input
              aria-label="Restore full backup"
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void run(async () => {
                  if (file.size > 10 * 1024 * 1024) throw new Error("Backup must be smaller than 10 MB.");
                  const result = backupSchema.safeParse(JSON.parse(await file.text()));
                  if (!result.success) {
                    throw new Error(`Invalid backup: ${result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
                  }
                  if (!await confirmAction("Restore full backup?", "This replaces all website content. Every replaced document remains recorded in history.")) return;
                  await saveDocuments(result.data.documents, {
                    actionType: "restored",
                    summaries: Object.fromEntries(documentKeys.map((documentKey) => [documentKey, `Restored ${documentLabels[documentKey]} from a full backup.`])) as Partial<Record<DocumentKey, string>>,
                  });
                }, "Full backup restored successfully.");
              }}
            />
          </label>
        </div>
      </header>
      <p className="rounded-xl bg-cream-100 p-4 text-sm text-ink-600">
        {hasSupabaseConfig
          ? "History is stored in the connected AFhomes database with the authenticated administrator and an exact timestamp in Philippine time."
          : "History is stored in this browser for local development. Connect Supabase for shared administrator history."}
      </p>
      {notice && (
        <p role="status" className={`whitespace-pre-line rounded-lg px-4 py-3 text-sm font-semibold ${/failed|unable|invalid|required/i.test(notice) ? "bg-coral-100 text-coral-700" : "bg-leaf-100 text-pine-900"}`}>
          {notice}
        </p>
      )}
      <details open className="rounded-xl border border-line bg-cream-100/50 p-5">
        <summary className="cursor-pointer font-display text-2xl text-navy-900">Search & filters</summary>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className="label-caps text-ink-500">Search summaries</span>
            <input type="search" className="cms-input" value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder="Phone, hero, page…" />
          </label>
          <label>
            <span className="label-caps text-ink-500">Section</span>
            <select className="cms-input" value={key} onChange={(event) => { setPage(0); setKey(event.target.value); }}>
              <option value="">All sections</option>
              {documentKeys.map((item) => <option key={item} value={item}>{documentLabels[item]}</option>)}
            </select>
          </label>
          <label>
            <span className="label-caps text-ink-500">Action</span>
            <select className="cms-input capitalize" value={action} onChange={(event) => { setPage(0); setAction(event.target.value); }}>
              <option value="">All actions</option>
              {actions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="label-caps text-ink-500">Administrator</span>
            <input className="cms-input" value={user} onChange={(event) => { setPage(0); setUser(event.target.value); }} placeholder="Email or user ID" />
          </label>
          <label>
            <span className="label-caps text-ink-500">From date</span>
            <input type="date" className="cms-input" value={dateFrom} onChange={(event) => { setPage(0); setDateFrom(event.target.value); }} />
          </label>
          <label>
            <span className="label-caps text-ink-500">To date</span>
            <input type="date" className="cms-input" value={dateTo} onChange={(event) => { setPage(0); setDateTo(event.target.value); }} />
          </label>
        </div>
        <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Clear filters</Button>
      </details>
      {loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : (
        <>
          <div className="space-y-3">
            {data?.map((row) => (
              <HistoryRow
                key={row.id}
                row={row}
                busy={busy}
                onRestore={() => void run(async () => {
                  if (!await confirmAction("Restore this version?", `Restore ${documentLabels[row.key]} version ${row.revision}. The current content will remain in history.`)) return;
                  await restoreHistorySnapshot(row);
                }, `${documentLabels[row.key]} restored successfully.`)}
              />
            ))}
          </div>
          {!data?.length && (
            <div className="rounded-xl border border-dashed border-line p-10 text-center">
              <h3 className="font-display text-2xl text-navy-900">No history found</h3>
              <p className="mt-2 text-sm text-ink-500">Try clearing filters, or make a content update to begin the audit trail.</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button disabled={(data?.length ?? 0) < 25} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </>
      )}
    </section>
  );
}
