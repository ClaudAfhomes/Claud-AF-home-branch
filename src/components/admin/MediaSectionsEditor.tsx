import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminDraft } from "@/components/admin/DraftContext";
import { cmsRepository } from "@/lib/cms";
import { uploadMedia } from "@/lib/media";
import { cmsMediaPages, type CmsMediaBlock, type CmsMediaKind, type CmsMediaOverlay, type CmsMediaPlacement, type CmsMediaPosition, type CmsMediaWidth } from "@/types/mediaBlock";

const emptyBlock = (): CmsMediaBlock => ({
  id: crypto.randomUUID(), page: "/", placement: "page-background", kind: "image", src: "", alt: "", caption: "", width: "full", fit: "cover", position: "center", overlay: "medium", autoplay: true, loop: true, muted: true,
});

export function MediaSectionsEditor({ notify }: { notify: (message: string) => void }) {
  const [blocks, setBlocks] = useAdminDraft(() => cmsRepository.getMediaBlocks());
  const [uploadingId, setUploadingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (id: string, patch: Partial<CmsMediaBlock>) => setBlocks((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const move = (index: number, direction: -1 | 1) => setBlocks((items) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next;
  });
  const upload = async (block: CmsMediaBlock, file: File) => {
    setUploadingId(block.id);
    try {
      const src = await uploadMedia(file);
      update(block.id, { src, kind: file.type.startsWith("video/") ? "video" : "image", alt: block.alt || file.name.replace(/\.[^.]+$/, "") });
    } catch (cause) { window.alert(cause instanceof Error ? cause.message : "Upload failed"); }
    finally { setUploadingId(""); }
  };
  const save = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const backgroundPages = blocks.filter((block) => block.placement === "page-background").map((block) => block.page);
      if (new Set(backgroundPages).size !== backgroundPages.length) throw new Error("Use only one page background for each page path.");
      await cmsRepository.saveMediaBlocks(blocks); notify("Page media saved");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save page media."); }
    finally { setSaving(false); }
  };

  return <section className="border border-line bg-cream-50 p-6 sm:p-9">
    <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-end"><div><p className="label-caps text-leaf-700">Page builder</p><h2 className="font-display mt-1 text-3xl font-medium text-navy-900">Images & videos</h2><p className="mt-2 text-sm text-ink-600">Replace a page's hero background with an image or video, or add ordered media sections before and after its content.</p></div><Button disabled={saving} variant="accent" size="sm" onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button></div>
    {error && <p className="mt-4 text-sm font-semibold text-coral-700" role="alert">{error}</p>}
    <div className="mt-6"><Button size="sm" onClick={() => setBlocks((items) => [...items, emptyBlock()])}>+ Add image or video</Button></div>
    <div className="mt-7 space-y-6">{blocks.map((block, index) => <article key={block.id} className="border border-line bg-cream-100/60 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-2xl text-navy-900">{block.kind === "video" ? "Video" : "Image"} section</h3><div className="flex gap-3 text-sm font-semibold"><button type="button" disabled={index === 0} onClick={() => move(index, -1)}>Move up</button><button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, 1)}>Move down</button><button type="button" className="text-coral-700" onClick={() => { if (window.confirm("Delete this media section?")) setBlocks((items) => items.filter((item) => item.id !== block.id)); }}>Delete</button></div></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label><span className="label-caps text-ink-500">Page path</span><input required list="cms-media-pages" className="cms-input" value={block.page} onChange={(event) => update(block.id, { page: event.target.value.toLowerCase() })} /><datalist id="cms-media-pages">{cmsMediaPages.map((page) => <option key={page.value} value={page.value}>{page.label}</option>)}</datalist></label>
        <label><span className="label-caps text-ink-500">Position</span><select className="cms-input" value={block.placement} onChange={(event) => update(block.id, { placement: event.target.value as CmsMediaPlacement })}><option value="page-background">Page hero background</option><option value="before-page">Before page content</option><option value="after-page">After page content</option></select></label>
        <label><span className="label-caps text-ink-500">Media type</span><select className="cms-input" value={block.kind} onChange={(event) => update(block.id, { kind: event.target.value as CmsMediaKind })}><option value="image">Image</option><option value="video">Video</option></select></label>
        {block.placement !== "page-background" && <label><span className="label-caps text-ink-500">Width</span><select className="cms-input" value={block.width} onChange={(event) => update(block.id, { width: event.target.value as CmsMediaWidth })}><option value="content">Content width</option><option value="wide">Wide</option><option value="full">Full browser width</option></select></label>}
        <label className="sm:col-span-2"><span className="label-caps text-ink-500">Media URL</span><input required type="url" className="cms-input" value={block.src} onChange={(event) => update(block.id, { src: event.target.value })} /></label>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-semibold"><span>{uploadingId === block.id ? "Uploading…" : "Upload file"}</span><input type="file" disabled={Boolean(uploadingId)} accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(block, file); }} /></label>
        <label><span className="label-caps text-ink-500">Display</span><select className="cms-input" value={block.fit} onChange={(event) => update(block.id, { fit: event.target.value as "cover" | "contain" })}><option value="cover">Fill and crop</option><option value="contain">Show entire media</option></select></label>
        {block.placement === "page-background" && <>
          <label><span className="label-caps text-ink-500">Focal position</span><select className="cms-input" value={block.position ?? "center"} onChange={(event) => update(block.id, { position: event.target.value as CmsMediaPosition })}><option value="center">Center</option><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
          <label><span className="label-caps text-ink-500">Text overlay</span><select className="cms-input" value={block.overlay ?? "medium"} onChange={(event) => update(block.id, { overlay: event.target.value as CmsMediaOverlay })}><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label>
        </>}
        <label className="sm:col-span-2"><span className="label-caps text-ink-500">Accessible description</span><input className="cms-input" value={block.alt} onChange={(event) => update(block.id, { alt: event.target.value })} /></label>
        <label className="sm:col-span-2"><span className="label-caps text-ink-500">Optional caption</span><textarea rows={2} className="cms-input resize-y" value={block.caption} onChange={(event) => update(block.id, { caption: event.target.value })} /></label>
        {block.kind === "video" && <div className="sm:col-span-2 flex flex-wrap gap-5 text-sm"><label><input type="checkbox" checked={Boolean(block.autoplay)} onChange={(event) => update(block.id, { autoplay: event.target.checked, muted: event.target.checked || block.muted })} /> Autoplay muted</label><label><input type="checkbox" checked={Boolean(block.loop)} onChange={(event) => update(block.id, { loop: event.target.checked })} /> Loop</label><label><input type="checkbox" checked={Boolean(block.muted)} onChange={(event) => update(block.id, { muted: event.target.checked })} /> Muted</label></div>}
      </div>
      {block.src && <div className="mt-5 overflow-hidden border border-line bg-cream-50">{block.kind === "video" ? <video src={block.src} controls className="max-h-80 w-full object-contain" /> : <img src={block.src} alt="" className="max-h-80 w-full object-contain" />}</div>}
    </article>)}</div>
  </section>;
}
