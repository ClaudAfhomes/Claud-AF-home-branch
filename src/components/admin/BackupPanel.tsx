import { useState } from "react";
import { cmsRepository, historyValue, listHistory, saveDocuments } from "@/lib/cms";
import { backupSchema, documentKeys } from "@/lib/cmsValidation";
import { hasSupabaseConfig } from "@/lib/supabase";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";

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
export function BackupPanel() {
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const { data, loading, error, retry } = useAsync(() => listHistory(page), [page]);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setNotice("");
    try { await work(); setNotice("Content saved successfully."); retry(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Operation failed"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-6 border border-line bg-cream-50 p-6"><h2 className="font-display text-3xl text-navy-900">Backups & history</h2><p>{hasSupabaseConfig ? "Download all website content, including archived records. A restore replaces all six content sections together in the connected database. Previous document versions are stored in revision history." : "Download all website content, including archived records. A restore replaces all six content sections together. Uploaded images used in content are included. The ten most recent prior document versions are retained locally."}</p><fieldset disabled={busy} className="flex flex-wrap gap-4"><Button onClick={() => downloadJson(contentBackup(), "afhomes-content-backup.json")}>Download full backup</Button><Button variant="outline" onClick={() => void run(async () => { if (!window.confirm(hasSupabaseConfig ? "Save the current website content to the database? Existing content will be versioned." : "Save the current website content to this browser? Existing content will be versioned.")) return; await saveDocuments(contentBackup().documents); })}>{hasSupabaseConfig ? "Save current content" : "Save current content locally"}</Button><label className="cursor-pointer rounded-full border border-line px-5 py-3 text-sm font-semibold">Restore full backup<input aria-label="Restore full backup" type="file" accept="application/json" className="sr-only" onChange={(event) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    void run(async () => {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backup must be smaller than 10 MB.");
      const result = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!result.success) throw new Error(`Invalid backup: ${result.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
      if (!window.confirm("Replace all website content with this backup? Previous versions will remain in history.")) return;
      await saveDocuments(result.data.documents);
    });
  }} /></label><Button variant="outline" onClick={() => {
    const documents: Record<string, unknown> = {};
    for (const key of documentKeys) { const raw = localStorage.getItem(`afhomes.cms.${key}`); if (raw) documents[key] = JSON.parse(raw); }
    downloadJson({ format: "afhomes-legacy-browser", version: 1, documents }, "afhomes-legacy-browser-backup.json");
  }}>Export old browser data</Button></fieldset>{notice && <p role="status" className="whitespace-pre-line text-pine-800">{notice}</p>}<h3 className="font-display text-2xl">Previous versions</h3>{loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : <><ul className="divide-y divide-line">{data?.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span>{row.key} · version {row.revision} · {new Date(row.saved_at).toLocaleString()}</span><Button disabled={busy} variant="outline" size="sm" onClick={() => void run(async () => {
    if (!window.confirm(`Restore ${row.key} version ${row.revision}?`)) return;
    await saveDocuments({ [row.key]: await historyValue(row.id) });
  })}>Restore version</Button></li>)}</ul>{!data?.length && <p>No previous versions on this page.</p>}<div className="flex gap-4"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={(data?.length ?? 0) < 25} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>}</section>;
}
