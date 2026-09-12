import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminDraft } from "@/components/admin/DraftContext";
import { cmsRepository, saveDocuments } from "@/lib/cms";
import { uploadImage } from "@/lib/media";
import type { CmsMediaBlock } from "@/types/mediaBlock";
import type { PageContent } from "@/types/pageContent";

interface HeroDraft {
  pageContent: PageContent;
  mediaBlocks: CmsMediaBlock[];
}

function getHeroBlock(blocks: CmsMediaBlock[]) {
  return blocks.find((block) => block.page === "/" && block.placement === "page-background");
}

function Field({ label, value, onChange, area = false }: { label: string; value: string; onChange: (value: string) => void; area?: boolean }) {
  return <label className="block"><span className="label-caps text-ink-500">{label}</span>{area ? <textarea rows={4} className="cms-input resize-y" value={value} onChange={(event) => onChange(event.target.value)} /> : <input className="cms-input" value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export function HeroEditor({ notify }: { notify: (message: string) => void }) {
  const [draft, setDraft] = useAdminDraft<HeroDraft>(() => ({ pageContent: cmsRepository.getPageContent(), mediaBlocks: cmsRepository.getMediaBlocks() }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const hero = draft.pageContent.home;
  const media = getHeroBlock(draft.mediaBlocks);
  const updateText = (key: keyof Pick<PageContent["home"], "heroTitle" | "heroLede" | "heroBadge" | "heroPrimaryCta" | "heroSecondaryCta">, value: string) => setDraft((current) => ({ ...current, pageContent: { ...current.pageContent, home: { ...current.pageContent.home, [key]: value } } }));
  const updateMedia = (patch: Partial<CmsMediaBlock>) => setDraft((current) => {
    const existing = getHeroBlock(current.mediaBlocks);
    if (existing) return { ...current, mediaBlocks: current.mediaBlocks.map((block) => block.id === existing.id ? { ...block, ...patch } : block) };
    const created: CmsMediaBlock = { id: crypto.randomUUID(), page: "/", placement: "page-background", kind: "image", src: "", alt: "", caption: "", width: "full", fit: "cover", position: "center", overlay: "medium", ...patch };
    return { ...current, mediaBlocks: [...current.mediaBlocks, created] };
  });
  const removeMedia = () => setDraft((current) => ({ ...current, mediaBlocks: current.mediaBlocks.filter((block) => block.id !== media?.id) }));
  const reset = () => setDraft({ pageContent: cmsRepository.getPageContent(), mediaBlocks: cmsRepository.getMediaBlocks() });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await saveDocuments({ pageContent: draft.pageContent, mediaBlocks: draft.mediaBlocks }); notify("Hero section updated successfully."); }
    catch (cause) { notify(cause instanceof Error ? `Hero update failed: ${cause.message}` : "Hero update failed."); }
    finally { setSaving(false); }
  };

  return <section className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-soft"><header className="border-b border-line px-5 py-6 sm:px-8"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="label-caps text-leaf-700">Homepage</p><h2 className="font-display mt-2 text-4xl font-medium text-navy-900">Hero section</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">Edit the first message and background visitors see on the AFhomes homepage.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={reset}>Cancel</Button><Button variant="outline" size="sm" onClick={() => window.open("/", "_blank", "noopener,noreferrer")}>Preview</Button><Button variant="accent" size="sm" disabled={saving} onClick={() => void save()}>{saving ? "Updating…" : "Update hero"}</Button></div></div></header><div className="grid gap-8 p-5 sm:p-8 xl:grid-cols-[1fr_22rem]"><div className="space-y-5"><Field label="Eyebrow / badge" value={hero.heroBadge} onChange={(value) => updateText("heroBadge", value)} /><Field label="Headline" value={hero.heroTitle} onChange={(value) => updateText("heroTitle", value)} area /><Field label="Introduction" value={hero.heroLede} onChange={(value) => updateText("heroLede", value)} area /><div className="grid gap-5 sm:grid-cols-2"><Field label="Primary button label" value={hero.heroPrimaryCta} onChange={(value) => updateText("heroPrimaryCta", value)} /><Field label="Secondary button label" value={hero.heroSecondaryCta} onChange={(value) => updateText("heroSecondaryCta", value)} /></div></div><aside className="rounded-xl border border-line bg-cream-100 p-4"><p className="label-caps text-ink-500">Hero background</p><div className="mt-3 aspect-[4/3] overflow-hidden rounded-lg bg-navy-950">{media?.src ? media.kind === "video" ? <video src={media.src} controls className="h-full w-full object-cover" /> : <img src={media.src} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-cream-200">The current built-in resort image remains visible until you upload a replacement.</div>}</div><p className="mt-3 text-xs leading-relaxed text-ink-500">For faster pages, upload a WebP or JPEG around 1920 × 1080 px and under 1 MB where possible.</p><div className="mt-4 flex flex-wrap gap-3"><label className="cursor-pointer rounded-full bg-pine-800 px-4 py-2 text-xs font-semibold text-cream-50"><span>{uploading ? "Uploading…" : media?.src ? "Replace image" : "Upload image"}</span><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setUploading(true); try { updateMedia({ src: await uploadImage(file), kind: "image", alt: media?.alt || file.name.replace(/\.[^.]+$/, "") }); } catch (cause) { notify(cause instanceof Error ? cause.message : "Upload failed."); } finally { setUploading(false); } }} /></label>{media?.src && <button type="button" onClick={removeMedia} className="text-xs font-semibold text-coral-700">Remove</button>}</div>{media?.src && <div className="mt-5 space-y-4"><Field label="Image alt text" value={media.alt} onChange={(value) => updateMedia({ alt: value })} /><label className="block"><span className="label-caps text-ink-500">Crop / focal point</span><select className="cms-input" value={media.position ?? "center"} onChange={(event) => updateMedia({ position: event.target.value as CmsMediaBlock["position"] })}><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label><label className="block"><span className="label-caps text-ink-500">Text overlay</span><select className="cms-input" value={media.overlay ?? "medium"} onChange={(event) => updateMedia({ overlay: event.target.value as CmsMediaBlock["overlay"] })}><option value="light">Light</option><option value="medium">Medium</option><option value="strong">Strong</option></select></label></div>}</aside></div></section>;
}
