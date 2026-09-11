import { supabase } from "@/lib/supabase";
import type { BlockType, CmsPage, CmsPageSection, PublishedPage } from "@/types/pageBuilder";

function client() {
  if (!supabase) throw new Error("Supabase is required for the visual page builder.");
  return supabase;
}

export const blockLabels: Record<BlockType, string> = {
  hero: "Hero", "rich-text": "Rich text", image: "Image", gallery: "Image gallery", video: "Video", "two-column": "Two-column text & image", features: "Feature cards", services: "Service cards", testimonials: "Testimonials", faq: "FAQ", cta: "CTA banner", contact: "Contact information", map: "Map / embed link", divider: "Divider / spacer",
};

export function defaultBlockContent(type: BlockType): Record<string, unknown> {
  const defaults: Record<BlockType, Record<string, unknown>> = {
    hero: { eyebrow: "Welcome", title: "New page", text: "Add an introduction.", buttonLabel: "Learn more", buttonHref: "/contact", mediaUrl: "", mediaType: "image", position: "center", overlay: "medium" },
    "rich-text": { heading: "Section heading", body: "Add your content here." },
    image: { url: "", alt: "", caption: "", aspectRatio: "16/9", fit: "cover", position: "center" },
    gallery: { heading: "Gallery", items: [] }, video: { url: "", caption: "", autoplay: false, loop: false },
    "two-column": { heading: "Section heading", body: "Add your content here.", imageUrl: "", imageAlt: "", imageSide: "right" },
    features: { heading: "Features", items: [{ title: "Feature", text: "Describe this feature." }] },
    services: { heading: "Services", items: [{ title: "Service", text: "Describe this service.", href: "/contact" }] },
    testimonials: { heading: "Testimonials", items: [{ quote: "Add a customer quotation.", name: "Customer" }] },
    faq: { heading: "Frequently asked questions", items: [{ question: "Question", answer: "Answer" }] },
    cta: { heading: "Ready to learn more?", text: "Contact AFhomes today.", buttonLabel: "Contact us", buttonHref: "/contact" },
    contact: { heading: "Contact us", text: "We would love to hear from you.", email: "", phone: "" },
    map: { heading: "Find us", embedUrl: "" }, divider: { size: "medium" },
  };
  return structuredClone(defaults[type]);
}

export async function listCmsPages(): Promise<CmsPage[]> {
  const { data, error } = await client().from("cms_pages").select("*").order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CmsPage[];
}

export async function createCmsPage(title: string, slug: string): Promise<CmsPage> {
  const { data, error } = await client().from("cms_pages").insert({ title, slug, seo_title: title, seo_description: "" }).select().single();
  if (error) throw new Error(error.message);
  return data as CmsPage;
}

export async function loadDraftSections(pageId: string): Promise<CmsPageSection[]> {
  const { data, error } = await client().from("cms_page_sections").select("*").eq("page_id", pageId).order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as CmsPageSection[];
}

export async function saveCmsPage(page: CmsPage, sections: CmsPageSection[]): Promise<void> {
  const { error: pageError } = await client().from("cms_pages").update({ slug: page.slug, title: page.title, seo_title: page.seo_title, seo_description: page.seo_description, updated_at: new Date().toISOString() }).eq("id", page.id);
  if (pageError) throw new Error(pageError.message);
  const rows = sections.map((section, index) => ({ ...section, page_id: page.id, sort_order: index, updated_at: new Date().toISOString() }));
  if (rows.length) {
    const { error } = await client().from("cms_page_sections").upsert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function deleteCmsSection(id: string) {
  const { error } = await client().from("cms_page_sections").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCmsPage(id: string) {
  const { error } = await client().from("cms_pages").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function publishCmsPage(id: string) {
  const { error } = await client().rpc("publish_cms_page", { target_page_id: id });
  if (error) throw new Error(error.message);
}

export async function unpublishCmsPage(id: string) {
  const { error } = await client().rpc("unpublish_cms_page", { target_page_id: id });
  if (error) throw new Error(error.message);
}

export async function loadPublishedPage(slug: string): Promise<PublishedPage | null> {
  if (!supabase) return null;
  const { data: page, error } = await supabase.from("cms_published_pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!page) return null;
  const { data: sections, error: sectionError } = await supabase.from("cms_published_sections").select("*").eq("page_id", page.id).eq("is_visible", true).order("sort_order");
  if (sectionError) throw new Error(sectionError.message);
  return { ...page, sections: (sections ?? []) as CmsPageSection[] } as PublishedPage;
}
