export type PageStatus = "draft" | "published";
export type BlockType = "hero" | "rich-text" | "image" | "gallery" | "video" | "two-column" | "features" | "services" | "listings" | "testimonials" | "faq" | "cta" | "contact" | "map" | "divider";

export interface CmsPage {
  id: string;
  slug: string;
  title: string;
  seo_title: string;
  seo_description: string;
  open_graph_title: string;
  open_graph_description: string;
  open_graph_image: string;
  status: PageStatus;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface CmsPageSection {
  id: string;
  page_id: string;
  block_type: BlockType;
  content: Record<string, unknown>;
  sort_order: number;
  is_visible: boolean;
}

export interface PublishedPage {
  id: string;
  slug: string;
  title: string;
  seo_title: string;
  seo_description: string;
  open_graph_title: string;
  open_graph_description: string;
  open_graph_image: string;
  published_at: string;
  sections: CmsPageSection[];
}

export interface CmsPageVersion {
  id: number;
  page_id: string;
  title: string;
  created_at: string;
}
