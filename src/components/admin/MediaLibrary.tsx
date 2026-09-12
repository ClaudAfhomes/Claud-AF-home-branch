import { useEffect, useState } from "react";
import { builtInMedia, deleteMedia, uploadMedia, listMedia, mediaMaxLabel, mediaUsage, updateMediaMetadata, type LocalMedia } from "@/lib/media";
import { useAsync } from "@/hooks/useAsync";
import { SmartImage } from "@/components/ui/SmartImage";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { confirmAction, showToast } from "@/lib/dialog";

const categories = ["general", "hero", "rooms", "amenities", "gallery", "offers", "seo"];
const prettyCategory = (value: string) => value.replace(/^./, (letter) => letter.toUpperCase());
const formatBytes = (value?: number) => value ? `${(value / 1024 / 1024).toFixed(value > 1024 * 1024 ? 1 : 2)} MB` : "Size unavailable";

function MediaCard({ file, usage, busy, setBusy, setNotice, retry }: { file: LocalMedia; usage: string[]; busy: boolean; setBusy: (value: boolean) => void; setNotice: (value: string) => void; retry: () => void }) {
  const [altText, setAltText] = useState(file.altText);
  const [category, setCategory] = useState(file.category);
  const changed = altText !== file.altText || category !== file.category;
  return <article className="min-w-0 overflow-hidden rounded-xl border border-line bg-cream-50 shadow-subtle"><div className="relative bg-cream-200">{file.kind === "video" ? <video controls preload="metadata" className="aspect-4/3 w-full object-cover"><source src={file.src} /></video> : <SmartImage spec={{ src: file.src, alt: altText || file.name }} className="aspect-4/3 w-full object-cover" />}<span className="absolute top-3 left-3 rounded-full bg-navy-950/80 px-3 py-1 text-[0.65rem] font-semibold text-cream-50 backdrop-blur">{prettyCategory(category)}</span></div><div className="space-y-4 p-4"><div><p className="truncate text-sm font-semibold text-navy-900" title={file.name}>{file.name}</p><p className="mt-1 text-xs text-ink-400">{formatBytes(file.sizeBytes)} · {file.kind}</p></div><label className="block"><span className="label-caps text-ink-500">Folder / category</span><select className="cms-input" value={category} onChange={(event) => setCategory(event.target.value)}>{[...new Set([category, ...categories])].map((item) => <option key={item} value={item}>{prettyCategory(item)}</option>)}</select></label>{file.kind === "image" && <label className="block"><span className="label-caps text-ink-500">Library alt text</span><textarea rows={2} className="cms-input resize-y" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe the image for accessibility" /></label>}<div className={`rounded-lg px-3 py-2 text-xs ${usage.length ? "bg-gold-100 text-ink-700" : "bg-leaf-100 text-pine-900"}`}>{usage.length ? <><strong>Used in:</strong> {usage.join(", ")}</> : "Not currently used on a page"}</div><div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !changed} onClick={async () => { setBusy(true); setNotice(""); try { await updateMediaMetadata(file, { altText, category }); setNotice("Media details updated."); retry(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Unable to update media."); } finally { setBusy(false); } }}>Save details</Button><Button variant="outline" size="sm" disabled={busy || usage.length > 0} className="border-coral-300 text-coral-700 hover:border-coral-700" onClick={async () => { if (!await confirmAction("Delete media?", `Permanently delete ${file.name}? This cannot be undone.`)) return; setBusy(true); setNotice(""); try { await deleteMedia(file); setNotice("Media permanently deleted."); retry(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Unable to delete media."); } finally { setBusy(false); } }}>Delete</Button></div>{usage.length > 0 && <p className="text-xs leading-relaxed text-ink-400">Deletion is protected while this file is in use. Replace it in the listed content first.</p>}</div></article>;
}

export function MediaLibrary() {
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [usages, setUsages] = useState<Record<string, string[]>>({});
  const { data, loading, error, retry } = useAsync(() => listMedia(page), [page]);
  useEffect(() => {
    let active = true;
    if (!data) return;
    void Promise.all(data.map(async (file) => [file.id, await mediaUsage(file)] as const)).then((entries) => { if (active) setUsages(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [data]);
  useEffect(() => {
    if (!notice) return;
    void showToast(notice, /failed|error|unable|invalid/i.test(notice) ? "error" : "success");
  }, [notice]);
  const availableMedia = page === 0 ? [...builtInMedia, ...(data ?? [])] : data ?? [];
  const filtered = availableMedia.filter((file) => (category === "all" || file.category === category) && (!search.trim() || `${file.name} ${file.altText}`.toLowerCase().includes(search.trim().toLowerCase())));
  return <section className="rounded-2xl border border-line bg-cream-50 p-5 shadow-soft sm:p-8"><header className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-end"><div><p className="label-caps text-leaf-700">Reusable assets</p><h2 className="font-display mt-1 text-4xl text-navy-900">Media library</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">Upload, search, categorize, describe, and safely manage website photos and videos up to {mediaMaxLabel}.</p></div><div className="flex flex-wrap items-end gap-2"><label><span className="label-caps text-ink-500">Upload to</span><select className="cms-input mt-1 py-2" value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{prettyCategory(item)}</option>)}</select></label><label className="inline-flex cursor-pointer items-center rounded-full bg-pine-800 px-5 py-3 text-sm font-semibold text-cream-50"><span>{uploading ? "Uploading…" : "Upload media"}</span><input aria-label="Upload media" disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setUploading(true); setNotice(""); try { await uploadMedia(file, { category: uploadCategory, altText: file.type.startsWith("image/") ? file.name.replace(/\.[^.]+$/, "") : "" }); setNotice("Media uploaded successfully."); setPage(0); retry(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Upload failed."); } finally { setUploading(false); } }} /></label></div></header><div className="mt-6 grid gap-4 sm:grid-cols-[1fr_13rem]"><label><span className="label-caps text-ink-500">Search media</span><input type="search" className="cms-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search file name or alt text" /></label><label><span className="label-caps text-ink-500">Category</span><select className="cms-input" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{prettyCategory(item)}</option>)}</select></label></div>{notice && <p role="status" className="mt-4 rounded-lg bg-leaf-100 px-4 py-3 text-sm font-semibold text-pine-900">{notice}</p>}{loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : <><div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((file) => <MediaCard key={file.id} file={file} usage={usages[file.id] ?? []} busy={busy} setBusy={setBusy} setNotice={setNotice} retry={retry} />)}</div>{filtered.length === 0 && <div className="mt-7 rounded-xl border border-dashed border-line p-10 text-center"><h3 className="font-display text-2xl text-navy-900">No media found</h3><p className="mt-2 text-sm text-ink-500">Try another search or upload the first file in this category.</p></div>}<div className="mt-7 flex gap-3"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={(data?.length ?? 0) < 24} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>}</section>;
}
