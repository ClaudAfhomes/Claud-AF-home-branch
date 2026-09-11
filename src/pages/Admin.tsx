import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cmsRepository } from "@/lib/cms";
import { logoutAdmin } from "@/lib/adminAuth";
import { isStoryBackup } from "@/lib/storyBackup";
import { DraftContext, useAdminDraft } from "@/components/admin/DraftContext";
import { uploadImage } from "@/lib/media";
import { BackupPanel } from "@/components/admin/BackupPanel";
import { InquiryInbox } from "@/components/admin/InquiryInbox";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { MediaSectionsEditor } from "@/components/admin/MediaSectionsEditor";
import type { ImageSpec } from "@/lib/images";
import type { SiteConfig } from "@/types/site";
import type { Experience, ExperienceStatus } from "@/types/experience";
import type { VipPlan, VipTierId } from "@/types/vip";
import type { FaqCategory } from "@/types/faq";
import type { Story } from "@/types/story";
import type { PageContent } from "@/types/pageContent";

type Tab = "overview" | "site" | "pages" | "page-media" | "experiences" | "vip" | "faq" | "stories" | "backups" | "inbox" | "media";
const tabs: { id: Tab; label: string }[] = [
  { id: "inbox", label: "Inbox" }, { id: "media", label: "Media" }, { id: "backups", label: "Backups & history" },
  { id: "overview", label: "Overview" },
  { id: "site", label: "Site settings" },
  { id: "pages", label: "Pages" },
  { id: "page-media", label: "Page media" },
  { id: "experiences", label: "Experiences" },
  { id: "vip", label: "VIP plans" },
  { id: "faq", label: "FAQs" },
  { id: "stories", label: "Stories" },
];

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function Field({ label, value, onChange, area = false, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; area?: boolean; type?: string }) {
  return <label className="block"><span className="label-caps text-ink-500">{label}</span>{area ? <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} className="cms-input resize-y" /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="cms-input" />}</label>;
}

function ImageField({ label, image, onChange }: { label: string; image: ImageSpec; onChange: (image: ImageSpec) => void }) {
  const [uploading, setUploading] = useState(false);
  const readFile = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try { onChange({ ...image, src: await uploadImage(file) }); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Upload failed"); }
    finally { setUploading(false); }
  };

  return <div className="sm:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><Field label={label} value={image.src} onChange={(value) => onChange({ ...image, src: value })} type="url" /></div><label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-semibold text-pine-900 hover:border-pine-800 hover:bg-pine-800 hover:text-cream-50"><span>{uploading ? "Uploading..." : "Upload image"}</span><input disabled={uploading} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); event.target.value = ""; }} /></label></div><div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center"><div className="aspect-4/3 overflow-hidden rounded-lg border border-line bg-cream-200">{image.src && <img src={image.src} alt="" className="h-full w-full object-cover" />}</div><Field label="Image description" value={image.alt} onChange={(value) => onChange({ ...image, alt: value })} /></div></div>;
}

function Actions({ archived, featured, onEdit, onArchive, onFeature, onDelete }: { archived?: boolean; featured?: boolean; onEdit?: () => void; onArchive: () => void; onFeature?: () => void; onDelete: () => void }) {
  return <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">{onEdit && <button type="button" className="text-pine-800 hover:text-leaf-700" onClick={onEdit}>Edit</button>}{onFeature && <button type="button" className="text-pine-800 hover:text-leaf-700" onClick={onFeature}>{featured ? "Unfeature" : "Feature"}</button>}<button type="button" className="text-pine-800 hover:text-leaf-700" onClick={onArchive}>{archived ? "Restore" : "Archive"}</button><button type="button" className="text-coral-700 hover:text-coral-500" onClick={onDelete}>Delete</button></div>;
}

function Section({ title, description, children, onSave }: { title: string; description: string; children: ReactNode; onSave: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try { await onSave(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Save failed. Please try again."); }
    finally { setSaving(false); }
  };
  return <section className="border border-line bg-cream-50 p-6 sm:p-9"><fieldset disabled={saving}><div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-end"><div><p className="label-caps text-leaf-700">Content editor</p><h2 className="font-display mt-1 text-3xl font-medium text-navy-900">{title}</h2><p className="mt-2 text-sm text-ink-600">{description}</p><p className="mt-2 text-sm font-semibold text-pine-800">Edits are drafts until you save changes.</p></div><Button type="button" variant="accent" size="sm" onClick={() => void save()}>{saving ? "Saving..." : "Save changes"}</Button></div>{error && <p role="alert" className="mt-4 whitespace-pre-line text-coral-700">{error}</p>}{children}</fieldset></section>;
}
export default function Admin() {
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const markDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const dirty = dirtyIds.size > 0;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Discard your unsaved changes and leave this section?")) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabs.find((item) => item.id === searchParams.get("tab"))?.id ?? "overview";
  const setTab = (next: Tab) => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("tab", next);
      return updated;
    });
  };
  const [notice, setNotice] = useState("");
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  return <DraftContext.Provider value={markDirty}><div className="min-h-screen bg-cream-100 text-ink-800"><header className="border-b border-line bg-navy-950 text-cream-50"><Container className="flex items-center justify-between gap-5 py-5"><div><p className="label-caps text-leaf-300">AFhomes content studio</p><h1 className="font-display mt-1 text-2xl font-medium sm:text-3xl">Your digital home base.</h1></div><div className="flex items-center gap-4"><Link to="/" target="_blank" className="text-sm font-semibold text-cream-100 hover:text-leaf-300">View live site →</Link><button type="button" className="text-sm font-semibold text-cream-200/70 hover:text-cream-50" onClick={async () => { if (dirty && !window.confirm("Discard unsaved changes and sign out?")) return; try { await logoutAdmin(); window.location.assign("/admin/login"); } catch { notify("Sign out failed. Please try again."); } }}>Sign out</button></div></Container></header><Container className="py-8 sm:py-12"><div className="flex flex-wrap gap-2 border-b border-line pb-5" role="tablist" aria-label="CMS sections">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${tab === item.id ? "border-navy-800 bg-navy-800 text-cream-50" : "border-line bg-cream-50 text-ink-600 hover:border-leaf-600"}`}>{item.label}</button>)}</div>{notice && <p className="mt-5 rounded-lg bg-leaf-100 px-4 py-3 text-sm font-semibold text-pine-900" role="status">{notice}</p>}<p role="status" className="mt-4 text-sm font-semibold text-pine-800">{dirty ? "Unsaved changes" : "All changes saved"}</p><main className="mt-8">{tab === "inbox" && <InquiryInbox />}{tab === "media" && <MediaLibrary />}{tab === "backups" && <BackupPanel />}{tab === "overview" && <Overview onSelect={setTab} />}{tab === "site" && <SiteEditor notify={notify} />}{tab === "pages" && <PagesEditor notify={notify} />}{tab === "page-media" && <MediaSectionsEditor notify={notify} />}{tab === "experiences" && <ExperiencesEditor notify={notify} />}{tab === "vip" && <VipEditor notify={notify} />}{tab === "faq" && <FaqEditor notify={notify} />}{tab === "stories" && <StoriesEditor notify={notify} />}</main></Container></div></DraftContext.Provider>;
}

function Overview({ onSelect }: { onSelect: (tab: Tab) => void }) {
  const cards: [string, string, Tab][] = [["Site settings", "Brand, contact, navigation", "site"], ["Pages", "Headlines, descriptions, policies, images", "pages"], ["Experiences", `${cmsRepository.getAllExperiences().length} records`, "experiences"], ["VIP plans", `${cmsRepository.getAllVipPlans().length} records`, "vip"], ["FAQs", `${cmsRepository.getAllFaqCategories().reduce((total, category) => total + category.items.length, 0)} questions`, "faq"], ["Stories", `${cmsRepository.getAllStories().length} records`, "stories"]];
  return <div><p className="label-caps text-coral-600">Content management</p><h2 className="font-display mt-2 text-4xl font-medium text-navy-900 sm:text-5xl">Everything in one place.</h2><p className="mt-3 max-w-2xl text-ink-600">Add, edit, feature, archive, restore, or delete website content without opening the codebase.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, detail, id]) => <button key={id} type="button" onClick={() => onSelect(id)} className="border border-line bg-cream-50 p-6 text-left hover:border-leaf-600"><p className="font-display text-2xl font-medium text-navy-900">{title}</p><p className="mt-2 text-sm text-ink-500">{detail}</p><span className="mt-6 inline-block text-sm font-semibold text-pine-800">Manage →</span></button>)}</div></div>;
}

function SiteEditor({ notify }: { notify: (message: string) => void }) {
  const [config, setConfig] = useAdminDraft(() => cmsRepository.getSiteConfig());
  const updateBrand = (key: keyof SiteConfig["brand"], value: string) => setConfig((current) => ({ ...current, brand: { ...current.brand, [key]: value } }));
  const updateNav = (index: number, key: "label" | "path", value: string) => setConfig((current) => ({ ...current, nav: { ...current.nav, main: current.nav.main.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) } }));
  const updateExperienceNav = (index: number, key: "label" | "path" | "description", value: string) => setConfig((current) => ({ ...current, nav: { ...current.nav, experiences: current.nav.experiences.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) } }));
  return <Section title="Site settings" description="Edit brand, contact details, offices, and navigation." onSave={async () => { await cmsRepository.saveSiteConfig(config); notify("Site settings saved"); }}><div className="mt-8 grid gap-6 sm:grid-cols-2"><Field label="Brand name" value={config.brand.name} onChange={(value) => updateBrand("name", value)} /><Field label="Tagline" value={config.brand.tagline} onChange={(value) => updateBrand("tagline", value)} /><Field label="Brand mantra" value={config.brand.mantra} onChange={(value) => updateBrand("mantra", value)} /><Field label="Website URL" value={config.siteUrl} onChange={(value) => setConfig({ ...config, siteUrl: value })} /><Field label="Email" value={config.email} onChange={(value) => setConfig({ ...config, email: value })} /><Field label="Phone" value={config.phone} onChange={(value) => setConfig({ ...config, phone: value })} /><Field label="Phone display" value={config.phoneDisplay} onChange={(value) => setConfig({ ...config, phoneDisplay: value })} /></div><div className="mt-8 border-t border-line pt-8"><div className="flex items-center justify-between gap-4"><p className="label-caps text-ink-500">Main navigation</p><Button type="button" variant="outline" size="sm" onClick={() => setConfig({ ...config, nav: { ...config.nav, main: [...config.nav.main, { label: "New link", path: "/" }] } })}>+ Add link</Button></div><div className="mt-4 space-y-4">{config.nav.main.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Field label="Label" value={item.label} onChange={(value) => updateNav(index, "label", value)} /><Field label="Path" value={item.path} onChange={(value) => updateNav(index, "path", value)} /><button type="button" className="self-end px-3 py-3 text-sm font-semibold text-coral-700" onClick={() => setConfig({ ...config, nav: { ...config.nav, main: config.nav.main.filter((_, itemIndex) => itemIndex !== index) } })}>Remove</button></div>)}</div></div><div className="mt-8 border-t border-line pt-8"><div className="flex items-center justify-between gap-4"><p className="label-caps text-ink-500">Experience menu</p><Button type="button" variant="outline" size="sm" onClick={() => setConfig({ ...config, nav: { ...config.nav, experiences: [...config.nav.experiences, { label: "New experience", path: "/experiences", description: "" }] } })}>+ Add link</Button></div><div className="mt-4 space-y-4">{config.nav.experiences.map((item, index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><Field label="Label" value={item.label} onChange={(value) => updateExperienceNav(index, "label", value)} /><Field label="Path" value={item.path} onChange={(value) => updateExperienceNav(index, "path", value)} /><Field label="Description" value={item.description ?? ""} onChange={(value) => updateExperienceNav(index, "description", value)} /><button type="button" className="self-end px-3 py-3 text-sm font-semibold text-coral-700" onClick={() => setConfig({ ...config, nav: { ...config.nav, experiences: config.nav.experiences.filter((_, itemIndex) => itemIndex !== index) } })}>Remove</button></div>)}</div></div><div className="mt-8 border-t border-line pt-8"><div className="flex items-center justify-between gap-4"><p className="label-caps text-ink-500">Offices</p><Button type="button" variant="outline" size="sm" onClick={() => setConfig({ ...config, offices: [...config.offices, { name: "New office", role: "Office", lines: [""] }] })}>+ Add office</Button></div><div className="mt-4 space-y-4">{config.offices.map((office, index) => <div key={index} className="grid gap-3 border-b border-line pb-5 sm:grid-cols-2"><Field label="Office name" value={office.name} onChange={(value) => setConfig({ ...config, offices: config.offices.map((item, itemIndex) => itemIndex === index ? { ...item, name: value } : item) })} /><Field label="Role" value={office.role} onChange={(value) => setConfig({ ...config, offices: config.offices.map((item, itemIndex) => itemIndex === index ? { ...item, role: value } : item) })} /><div className="sm:col-span-2"><Field label="Address lines (one per line)" value={office.lines.join("\n")} onChange={(value) => setConfig({ ...config, offices: config.offices.map((item, itemIndex) => itemIndex === index ? { ...item, lines: value.split("\n") } : item) })} area /></div><button type="button" className="text-left text-sm font-semibold text-coral-700" onClick={() => setConfig({ ...config, offices: config.offices.filter((_, itemIndex) => itemIndex !== index) })}>Remove office</button></div>)}</div></div></Section>;
}

function PagesEditor({ notify }: { notify: (message: string) => void }) {
  const [content, setContent] = useAdminDraft(() => cmsRepository.getPageContent());
  const update = <S extends keyof PageContent, K extends keyof PageContent[S]>(section: S, key: K, value: PageContent[S][K]) => {
    setContent((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  };
  const field = <S extends keyof PageContent>(section: S, key: keyof PageContent[S], label: string, area = false) => {
    const value = content[section][key];
    if (typeof value !== "string") return null;
    return <Field label={label} value={value} area={area} onChange={(next) => update(section, key, next as PageContent[S][typeof key])} />;
  };

  return <Section title="Website pages" description="Edit the main text and imagery shown across the public website." onSave={async () => { await cmsRepository.savePageContent(content); notify("Page content saved"); }}><div className="mt-8 space-y-8">
    <PagePanel title="Home page"><div className="grid gap-5 sm:grid-cols-2">{field("home", "heroTitle", "Hero title")}{field("home", "heroLede", "Hero introduction", true)}{field("home", "brandTitle", "Brand section title")}{field("home", "brandLede", "Brand section text", true)}{field("home", "whyTitle", "Why AFhomes title")}{field("home", "whyLede", "Why AFhomes introduction", true)}<ImageField label="Brand section image" image={content.home.brandImage} onChange={(image) => update("home", "brandImage", image)} /></div></PagePanel>
    <PagePanel title="About page"><div className="grid gap-5 sm:grid-cols-2">{field("about", "eyebrow", "Eyebrow")}{field("about", "title", "Page title")}{field("about", "lede", "Introduction", true)}{field("about", "vision", "Vision", true)}{field("about", "mission", "Mission", true)}<ImageField label="Header image" image={content.about.image} onChange={(image) => update("about", "image", image)} /></div></PagePanel>
    <PagePanel title="Contact page"><div className="grid gap-5 sm:grid-cols-2">{field("contact", "eyebrow", "Eyebrow")}{field("contact", "title", "Page title")}{field("contact", "lede", "Introduction", true)}{field("contact", "emailLabel", "Email label")}{field("contact", "phoneLabel", "Phone label")}{field("contact", "formTitle", "Form title")}{field("contact", "formLede", "Form introduction", true)}</div></PagePanel>
    <PagePanel title="Experiences page"><div className="grid gap-5 sm:grid-cols-2">{field("experiences", "eyebrow", "Eyebrow")}{field("experiences", "title", "Page title")}{field("experiences", "lede", "Introduction", true)}<ImageField label="Header image" image={content.experiences.image} onChange={(image) => update("experiences", "image", image)} /></div></PagePanel>
    <PagePanel title="VIP page"><div className="grid gap-5 sm:grid-cols-2">{field("vip", "eyebrow", "Eyebrow")}{field("vip", "title", "Page title")}{field("vip", "lede", "Introduction", true)}</div></PagePanel>
    <PagePanel title="Stories page"><div className="grid gap-5 sm:grid-cols-2">{field("stories", "eyebrow", "Eyebrow")}{field("stories", "title", "Page title")}{field("stories", "lede", "Introduction", true)}<ImageField label="Header image" image={content.stories.image} onChange={(image) => update("stories", "image", image)} /></div></PagePanel>
    <PagePanel title="FAQ page"><div className="grid gap-5 sm:grid-cols-2">{field("faq", "eyebrow", "Eyebrow")}{field("faq", "title", "Page title")}{field("faq", "lede", "Introduction", true)}{field("faq", "browseTitle", "Category heading")}{field("faq", "contactPrompt", "Contact prompt", true)}</div></PagePanel>
    <PagePanel title="Compliance page"><div className="grid gap-5 sm:grid-cols-2">{field("compliance", "eyebrow", "Eyebrow")}{field("compliance", "title", "Page title")}{field("compliance", "lede", "Introduction", true)}{field("compliance", "commitmentTitle", "Commitment title")}{field("compliance", "commitmentLede", "Commitment text", true)}{field("compliance", "notInvestment", "Investment notice", true)}{field("compliance", "verifiedPayments", "Payment notice", true)}{field("compliance", "privacy", "Privacy policy", true)}{field("compliance", "terms", "Terms", true)}</div></PagePanel>
  </div></Section>;
}

function PagePanel({ title, children }: { title: string; children: ReactNode }) {
  return <details open className="border border-line bg-cream-100/60 p-5 sm:p-7"><summary className="cursor-pointer font-display text-2xl font-medium text-navy-900">{title}</summary><div className="mt-6 border-t border-line pt-6">{children}</div></details>;
}

function ExperiencesEditor({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useAdminDraft(() => cmsRepository.getAllExperiences());
  const update = (index: number, patch: Partial<Experience>) => { const next = items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item); setItems(next); };
  const add = () => { const next = [{ ...emptyExperience, id: makeId("experience"), slug: `new-experience-${Date.now()}` }, ...items]; setItems(next); notify("Experience added"); };
  const remove = (index: number) => { if (!window.confirm("Permanently delete this experience?")) return; const next = items.filter((_, itemIndex) => itemIndex !== index); setItems(next); notify("Experience removed from draft. Save changes to publish."); };
  const emptyExperience: Experience = { id: "", slug: "", name: "New AFhomes Experience", shortName: "New Experience", actionLabel: "Discover this experience", status: "in-development", statusLabel: "In Development", location: "Laguna, Philippines", headline: "A new AFhomes experience.", summary: "Add a short introduction.", description: "Add the full description.", highlights: ["Add a highlight"], theme: "nature", accent: "leaf", image: { src: "", alt: "" } };
  return <Section title="Experiences" description="Add, edit, feature, archive, restore, or delete destinations." onSave={async () => { await cmsRepository.saveExperiences(items); notify("Experiences saved"); }}><div className="mt-7"><Button type="button" variant="accent" size="sm" onClick={add}>+ Add experience</Button></div><div className="mt-8 space-y-8">{items.map((item, index) => <article key={item.id} className={`border p-5 sm:p-7 ${item.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-display text-2xl font-medium text-navy-900">{item.shortName}</h3>{item.archived && <Badge tone="coral">Archived</Badge>}</div><Actions archived={item.archived} featured={item.featured} onArchive={() => update(index, { archived: !item.archived })} onFeature={() => update(index, { featured: !item.featured })} onDelete={() => remove(index)} /></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Name" value={item.name} onChange={(value) => update(index, { name: value })} /><Field label="Short name" value={item.shortName} onChange={(value) => update(index, { shortName: value, slug: slugify(value) })} /><Field label="Location" value={item.location} onChange={(value) => update(index, { location: value })} /><Field label="Status label" value={item.statusLabel} onChange={(value) => update(index, { statusLabel: value })} /><Field label="Headline" value={item.headline} onChange={(value) => update(index, { headline: value })} /><Field label="Action label" value={item.actionLabel} onChange={(value) => update(index, { actionLabel: value })} /><Field label="Summary" value={item.summary} onChange={(value) => update(index, { summary: value })} area /><Field label="Description" value={item.description} onChange={(value) => update(index, { description: value })} area /><Field label="Highlights (one per line)" value={item.highlights.join("\n")} onChange={(value) => update(index, { highlights: value.split("\n").filter(Boolean) })} area /><ImageField label="Experience image" image={item.image} onChange={(image) => update(index, { image })} /><label className="block"><span className="label-caps text-ink-500">Status</span><select value={item.status} onChange={(event) => update(index, { status: event.target.value as ExperienceStatus })} className="cms-input"><option value="open">Open</option><option value="opening-soon">Opening soon</option><option value="in-development">In development</option></select></label></div></article>)}</div></Section>;
}

function VipEditor({ notify }: { notify: (message: string) => void }) {
  const [plans, setPlans] = useAdminDraft(() => cmsRepository.getAllVipPlans());
  const update = (index: number, patch: Partial<VipPlan>) => { const next = plans.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item); setPlans(next); };
  const add = () => { const next = [{ ...emptyVipPlan, id: makeId("vip") as VipTierId }, ...plans]; setPlans(next); notify("VIP tier added"); };
  const remove = (index: number) => { if (!window.confirm("Permanently delete this VIP tier?")) return; const next = plans.filter((_, itemIndex) => itemIndex !== index); setPlans(next); notify("VIP tier removed from draft. Save changes to publish."); };
  const emptyVipPlan: VipPlan = { id: "bronze", name: "New Tier", discountPercent: 0, validityYears: 1, pointsPerYear: 0, totalPoints: 0, cardholders: "Single cardholder", benefits: ["Add a benefit"], accentText: "text-ink-500", accentBg: "bg-navy-300" };
  return <Section title="VIP plans" description="Add, edit, feature, archive, restore, or delete membership tiers." onSave={async () => { await cmsRepository.saveVipPlans(plans); notify("VIP plans saved"); }}><div className="mt-7"><Button type="button" variant="accent" size="sm" onClick={add}>+ Add VIP tier</Button></div><div className="mt-8 grid gap-6 lg:grid-cols-3">{plans.map((plan, index) => <article key={plan.id} className={`border p-5 ${plan.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}><div className="flex items-center justify-between gap-3"><h3 className="font-display text-2xl font-medium text-navy-900">{plan.name}</h3>{plan.featured && <Badge tone="gold">Featured</Badge>}</div><div className="mt-4"><Actions archived={plan.archived} featured={plan.featured} onArchive={() => update(index, { archived: !plan.archived })} onFeature={() => update(index, { featured: !plan.featured })} onDelete={() => remove(index)} /></div><div className="mt-5 space-y-4"><Field label="Name" value={plan.name} onChange={(value) => update(index, { name: value })} /><Field label="Discount %" value={plan.discountPercent} onChange={(value) => update(index, { discountPercent: Number(value) })} type="number" /><Field label="Validity years" value={plan.validityYears} onChange={(value) => update(index, { validityYears: Number(value) })} type="number" /><Field label="Points per year" value={plan.pointsPerYear} onChange={(value) => update(index, { pointsPerYear: Number(value) })} type="number" /><Field label="Total points" value={plan.totalPoints} onChange={(value) => update(index, { totalPoints: Number(value) })} type="number" /><Field label="Cardholders" value={plan.cardholders} onChange={(value) => update(index, { cardholders: value })} /><Field label="Benefits (one per line)" value={plan.benefits.join("\n")} onChange={(value) => update(index, { benefits: value.split("\n").filter(Boolean) })} area /><ImageField label="VIP card image" image={plan.image ?? { src: "", alt: "" }} onChange={(image) => update(index, { image })} /></div></article>)}</div></Section>;
}

function FaqEditor({ notify }: { notify: (message: string) => void }) {
  const [categories, setCategories] = useAdminDraft(() => cmsRepository.getAllFaqCategories());
  const updateCategory = (index: number, patch: Partial<FaqCategory>) => setCategories((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateItem = (categoryIndex: number, itemIndex: number, patch: { question?: string; answer?: string; archived?: boolean }) => setCategories((current) => current.map((category, currentCategoryIndex) => currentCategoryIndex === categoryIndex ? { ...category, items: category.items.map((item, currentItemIndex) => currentItemIndex === itemIndex ? { ...item, ...patch } : item) } : category));
  const addCategory = () => { const next = [{ id: makeId("faq"), label: "New category", items: [{ question: "New question", answer: "New answer" }] }, ...categories]; setCategories(next); notify("FAQ category added"); };
  return <Section title="Frequently asked questions" description="Add, edit, archive, restore, or delete categories and questions." onSave={async () => { await cmsRepository.saveFaqCategories(categories); notify("FAQs saved"); }}><div className="mt-7"><Button type="button" variant="accent" size="sm" onClick={addCategory}>+ Add FAQ category</Button></div><div className="mt-8 space-y-8">{categories.map((category, categoryIndex) => <article key={category.id} className={`border p-5 sm:p-7 ${category.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><Field label="Category label" value={category.label} onChange={(value) => updateCategory(categoryIndex, { label: value })} /><Actions archived={category.archived} onArchive={() => updateCategory(categoryIndex, { archived: !category.archived })} onDelete={() => { if (!window.confirm("Permanently delete this FAQ category?")) return; const next = categories.filter((_, index) => index !== categoryIndex); setCategories(next); notify("FAQ category removed from draft. Save changes to publish."); }} /></div><div className="mt-6 space-y-5">{category.items.map((item, itemIndex) => <div key={`${category.id}-${itemIndex}`} className={`border-t border-line pt-5 ${item.archived ? "opacity-60" : ""}`}><div className="flex justify-between gap-3"><p className="label-caps text-ink-500">Question {itemIndex + 1}</p><Actions archived={item.archived} onArchive={() => updateItem(categoryIndex, itemIndex, { archived: !item.archived })} onDelete={() => updateCategory(categoryIndex, { items: category.items.filter((_, index) => index !== itemIndex) })} /></div><div className="mt-3 space-y-4"><Field label="Question" value={item.question} onChange={(value) => updateItem(categoryIndex, itemIndex, { question: value })} /><Field label="Answer" value={item.answer} onChange={(value) => updateItem(categoryIndex, itemIndex, { answer: value })} area /></div></div>)}<Button type="button" variant="outline" size="sm" onClick={() => updateCategory(categoryIndex, { items: [...category.items, { question: "New question", answer: "New answer" }] })}>+ Add question</Button></div></article>)}</div></Section>;
}

function StoriesEditor({ notify }: { notify: (message: string) => void }) {
  const [stories, setStories] = useAdminDraft(() => cmsRepository.getAllStories());
  const [active, setActive] = useState<Story | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const save = (story: Story) => { const normalized = { ...story, id: story.id || makeId("story"), slug: slugify(story.slug || story.title), content: story.content.map((text) => text.trim()).filter(Boolean) }; const next = stories.some((item) => item.id === normalized.id) ? stories.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...stories]; setStories(next); setActive(null); notify("Story added to draft. Save changes to publish."); };
  const remove = (story: Story) => { if (!window.confirm(`Permanently delete “${story.title}”?`)) return; const next = stories.filter((item) => item.id !== story.id); setStories(next); notify("Story removed from draft. Save changes to publish."); };
  return <Section title="Stories & Insights" description="Add, edit, feature, archive, restore, or delete editorial content." onSave={async () => { await cmsRepository.replaceStories(stories); notify("Stories saved"); }}><div className="mt-7 flex flex-wrap gap-3"><Button type="button" variant="accent" size="sm" onClick={() => setActive({ id: "", slug: "", title: "", category: "Blog", date: "", excerpt: "", content: [""], cover: { src: "", alt: "" } })}>+ Add story</Button><Button type="button" variant="outline" size="sm" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(stories, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "afhomes-stories.json"; link.click(); URL.revokeObjectURL(url); }}>Download backup</Button><Button type="button" variant="outline" size="sm" onClick={() => importRef.current?.click()}>Restore backup</Button><input ref={importRef} type="file" accept="application/json" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const restored = JSON.parse(await file.text()) as Story[]; if (!isStoryBackup(restored)) throw new Error(); setStories(restored); notify("Backup loaded into draft. Save changes to publish."); } catch { notify("That backup file is not valid"); } event.target.value = ""; }} /></div><div className="mt-7 divide-y divide-line border border-line bg-cream-50">{stories.map((story) => <div key={story.id} className={`flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${story.archived ? "bg-coral-100/30" : ""}`}><div><p className="font-display text-xl font-medium text-navy-900">{story.title}</p><p className="mt-1 text-sm text-ink-500">{story.category} · {story.date}</p></div><Actions archived={story.archived} featured={story.featured} onEdit={() => setActive(story)} onArchive={() => { const next = stories.map((item) => item.id === story.id ? { ...item, archived: !item.archived } : item); setStories(next); }} onFeature={() => { const next = stories.map((item) => item.id === story.id ? { ...item, featured: !item.featured } : item); setStories(next); }} onDelete={() => remove(story)} /></div>)}</div>{active && <StoryForm story={active} onCancel={() => setActive(null)} onSave={save} />}</Section>;
}

function StoryForm({ story, onCancel, onSave }: { story: Story; onCancel: () => void; onSave: (story: Story) => void }) {
  const [draft, setDraft] = useState(story);
  const update = <K extends keyof Story>(key: K, value: Story[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-100 overflow-y-auto bg-navy-950/70 px-4 py-8"><form className="mx-auto max-w-3xl border border-line bg-cream-50 p-6 shadow-2xl sm:p-10" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><div className="flex items-center justify-between border-b border-line pb-6"><h3 className="font-display text-3xl font-medium text-navy-900">{draft.id ? "Edit story" : "New story"}</h3><button type="button" className="text-sm font-semibold text-ink-500" onClick={onCancel}>Close</button></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Title" value={draft.title} onChange={(value) => update("title", value)} /></div><Field label="Category" value={draft.category} onChange={(value) => update("category", value)} /><Field label="Date" value={draft.date} onChange={(value) => update("date", value)} /><div className="sm:col-span-2"><Field label="URL slug" value={draft.slug} onChange={(value) => update("slug", slugify(value))} /></div><div className="sm:col-span-2"><Field label="Excerpt" value={draft.excerpt} onChange={(value) => update("excerpt", value)} area /></div><div className="sm:col-span-2"><Field label="Paragraphs (blank line between paragraphs)" value={draft.content.join("\n\n")} onChange={(value) => update("content", value.split(/\n\s*\n/))} area /></div><ImageField label="Cover image" image={draft.cover} onChange={(image) => update("cover", image)} /></div><div className="mt-8 flex justify-end gap-3 border-t border-line pt-6"><Button type="button" variant="outline" size="md" onClick={onCancel}>Cancel</Button><Button type="submit" variant="accent" size="md">Save story</Button></div></form></div>;
}




