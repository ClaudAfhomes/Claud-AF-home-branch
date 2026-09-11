import { useState } from "react";

import { deleteMedia, uploadMedia, listMedia, mediaMaxLabel } from "@/lib/media";
import { useAsync } from "@/hooks/useAsync";
import { SmartImage } from "@/components/ui/SmartImage";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";

export function MediaLibrary() {
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const { data, loading, error, retry } = useAsync(() => listMedia(page), [page]);
  return <section className="space-y-6"><h2 className="font-display text-3xl">Media library</h2><p>Upload photos or videos up to {mediaMaxLabel}. Copy the public URL into any editor for hero banners, galleries, and video embeds.</p><label className="inline-block cursor-pointer rounded-full border border-line px-5 py-3">{uploading ? "Uploading..." : "Upload media"}<input aria-label="Upload media" disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={async (event) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setUploading(true); setNotice("");
    try { await uploadMedia(file); setNotice("Media uploaded."); setPage(0); retry(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Upload failed"); }
    finally { setUploading(false); }
  }} /></label>{notice && <p role="status">{notice}</p>}{loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : <><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data?.map((file) => {
    const src = file.src;
    return <article key={file.id} className="min-w-0 border border-line bg-cream-50 p-4">{file.kind === "video" ? <video controls className="aspect-[4/3] w-full rounded-md object-cover"><source src={src} /></video> : <SmartImage spec={{ src, alt: file.name }} className="aspect-[4/3] w-full object-cover" />}<p className="my-3 break-all text-xs">{file.name}</p><input aria-label="Media URL" className="cms-input" value={src} readOnly onFocus={(event) => event.target.select()} /><div className="mt-3 flex flex-wrap gap-3"><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(src); setNotice("Media URL copied."); } catch { setNotice("Select the URL above and copy it manually."); } }}>Copy URL</Button><Button variant="outline" size="sm" disabled={Boolean(deletingId)} className="border-coral-300 text-coral-700 hover:border-coral-700" onClick={async () => {
      if (!window.confirm(`Permanently delete ${file.name}? If this file is used on a page, remove or replace that reference too.`)) return;
      setDeletingId(file.id); setNotice("");
      try { await deleteMedia(file); setNotice("Media permanently deleted."); retry(); }
      catch (cause) { setNotice(cause instanceof Error ? cause.message : "Unable to delete media."); }
      finally { setDeletingId(""); }
    }}>{deletingId === file.id ? "Deleting..." : "Delete"}</Button></div></article>;
  })}</div><div className="flex gap-4"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={(data?.length ?? 0) < 24} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>}</section>;
}


