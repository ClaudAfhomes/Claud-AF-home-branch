import { useEffect, useState } from "react";
import { cmsRepository, historyValue, listHistory, saveDocuments } from "@/lib/cms";
import { backupSchema, documentKeys, type DocumentKey } from "@/lib/cmsValidation";
import { hasSupabaseConfig } from "@/lib/supabase";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { confirmAction, showToast } from "@/lib/dialog";

const labels: Record<DocumentKey, string> = { site: "Settings", pageContent: "Website content", experiences: "Rooms / experiences", vip: "VIP plans", faq: "FAQs", stories: "Stories", mediaBlocks: "Page media" };
const actions = ["created", "updated", "deleted", "restored", "published", "unpublished"];

export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function contentBackup() {
  return { format: "afhomes-cms", version: 1, createdAt: new Date().toISOString(), documents: {
    site: cmsRepository.getSiteConfig(), pageContent: cmsRepository.getPageContent(), experiences: cmsRepository.getAllExperiences(),
    vip: cmsRepository.getAllVipPlans(), faq: cmsRepository.getAllFaqCategories(), stories: cmsRepository.getAllStories(), mediaBlocks: cmsRepository.getMediaBlocks(),
  } };
}

function safeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeSnapshot);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|token|secret|credential)/i.test(key)).map(([key, nested]) => [key, safeSnapshot(nested)]));
}

function exactChanges(before: unknown, after: unknown) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(before) || Array.isArray(after)) return [];
  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  return [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key])).map((key) => ({ key, before: previous[key], after: next[key] })).slice(0, 20);
}

function compact(value: unknown) {
  const encoded = typeof value === "string" ? value : JSON.stringify(value);
  if (encoded === undefined) return "Not set";
  return encoded.length > 180 ? `${encoded.slice(0, 177)}…` : encoded;
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
    setBusy(true); setNotice("");
    try { await work(); setNotice(success); retry(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { setBusy(false); }
  };
  const resetFilters = () => { setSearch(""); setKey(""); setAction(""); setUser(""); setDateFrom(""); setDateTo(""); setPage(0); };
  return <section className="space-y-7 rounded-2xl border border-line bg-cream-50 p-5 shadow-soft sm:p-8"><header className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-end"><div><p className="label-caps text-leaf-700">Audit trail & recovery</p><h2 className="font-display mt-1 text-4xl text-navy-900">Change History / Restore</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">See who changed what and when, inspect safe before-and-after values, or restore a previous content snapshot without deleting history.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => downloadJson(contentBackup(), "afhomes-content-backup.json")}>Download backup</Button><label className="cursor-pointer rounded-full border border-line px-5 py-3 text-sm font-semibold">Restore backup<input aria-label="Restore full backup" type="file" accept="application/json" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; void run(async () => { if (file.size > 10 * 1024 * 1024) throw new Error("Backup must be smaller than 10 MB."); const result = backupSchema.safeParse(JSON.parse(await file.text())); if (!result.success) throw new Error(`Invalid backup: ${result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`); if (!await confirmAction("Restore full backup?", "This replaces all website content. Every replaced document remains recorded in history.")) return; await saveDocuments(result.data.documents, { actionType: "restored", summaries: Object.fromEntries(documentKeys.map((documentKey) => [documentKey, `Restored ${labels[documentKey]} from a full backup.`])) }); }, "Full backup restored successfully."); }} /></label></div></header><p className="rounded-xl bg-cream-100 p-4 text-sm text-ink-600">{hasSupabaseConfig ? "History is stored in the connected AFhomes database with the authenticated administrator and an exact timestamp." : "History is stored in this browser for local development. Connect Supabase for shared administrator history."}</p>{notice && <p role="status" className={`whitespace-pre-line rounded-lg px-4 py-3 text-sm font-semibold ${/failed|unable|invalid|required/i.test(notice) ? "bg-coral-100 text-coral-700" : "bg-leaf-100 text-pine-900"}`}>{notice}</p>}<details open className="rounded-xl border border-line bg-cream-100/50 p-5"><summary className="cursor-pointer font-display text-2xl text-navy-900">Search & filters</summary><div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><label><span className="label-caps text-ink-500">Search summaries</span><input type="search" className="cms-input" value={search} onChange={(event) => { setPage(0); setSearch(event.target.value); }} placeholder="Phone, hero, page…" /></label><label><span className="label-caps text-ink-500">Section</span><select className="cms-input" value={key} onChange={(event) => { setPage(0); setKey(event.target.value); }}><option value="">All sections</option>{documentKeys.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label><label><span className="label-caps text-ink-500">Action</span><select className="cms-input capitalize" value={action} onChange={(event) => { setPage(0); setAction(event.target.value); }}><option value="">All actions</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span className="label-caps text-ink-500">Administrator</span><input className="cms-input" value={user} onChange={(event) => { setPage(0); setUser(event.target.value); }} placeholder="Email or user ID" /></label><label><span className="label-caps text-ink-500">From date</span><input type="date" className="cms-input" value={dateFrom} onChange={(event) => { setPage(0); setDateFrom(event.target.value); }} /></label><label><span className="label-caps text-ink-500">To date</span><input type="date" className="cms-input" value={dateTo} onChange={(event) => { setPage(0); setDateTo(event.target.value); }} /></label></div><Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Clear filters</Button></details>{loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : <><div className="space-y-3">{data?.map((row) => { const changes = exactChanges(row.value, row.after_value); return <details key={row.id} className="rounded-xl border border-line bg-cream-50 p-5"><summary className="cursor-pointer list-none"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-leaf-100 px-2.5 py-1 text-xs font-semibold text-pine-900">{labels[row.key]}</span><span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold capitalize text-ink-600">{row.action_type ?? "updated"}</span></div><p className="mt-3 font-semibold text-navy-900">{row.change_summary}</p><p className="mt-1 text-xs text-ink-400">{row.saved_by_email || row.saved_by || "Administrator"} · Version {row.revision}</p></div><time className="shrink-0 text-sm text-ink-500" dateTime={row.saved_at}>{new Date(row.saved_at).toLocaleString()}</time></div></summary><div className="mt-5 border-t border-line pt-5"><h3 className="font-display text-xl text-navy-900">Exact changes</h3>{changes.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-xs"><thead><tr className="text-ink-400"><th className="pb-2 pr-4">Field</th><th className="pb-2 pr-4">Before</th><th className="pb-2">After</th></tr></thead><tbody>{changes.map((change) => <tr key={change.key} className="border-t border-line align-top"><th className="py-3 pr-4 font-semibold text-ink-700">{change.key}</th><td className="py-3 pr-4 text-ink-500">{compact(change.before)}</td><td className="py-3 text-ink-700">{compact(change.after)}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-ink-500">This version changes a list or nested content structure. Use snapshot preview for the exact saved content.</p>}<details className="mt-4 rounded-lg bg-cream-100 p-4"><summary className="cursor-pointer text-sm font-semibold text-pine-800">Preview previous version</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs text-ink-600">{JSON.stringify(safeSnapshot(row.value), null, 2)}</pre></details><Button disabled={busy} variant="outline" size="sm" className="mt-4" onClick={() => void run(async () => { if (!await confirmAction("Restore this version?", `Restore ${labels[row.key]} version ${row.revision}. The current content will remain in history.`)) return; await saveDocuments({ [row.key]: await historyValue(row.id) }, { actionType: "restored", summaries: { [row.key]: `Restored ${labels[row.key]} to version ${row.revision}.` } }); }, `${labels[row.key]} restored successfully.`)}>Restore this version</Button></div></details>; })}</div>{!data?.length && <div className="rounded-xl border border-dashed border-line p-10 text-center"><h3 className="font-display text-2xl text-navy-900">No history found</h3><p className="mt-2 text-sm text-ink-500">Try clearing filters, or make a content update to begin the audit trail.</p></div>}<div className="flex gap-3"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={(data?.length ?? 0) < 25} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>}</section>;
}
