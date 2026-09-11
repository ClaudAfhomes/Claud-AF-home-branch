import type { Story } from "@/types/story";
import type { SiteConfig } from "@/types/site";
import type { Experience } from "@/types/experience";
import type { VipPlan } from "@/types/vip";
import type { FaqCategory } from "@/types/faq";
import type { PageContent } from "@/types/pageContent";
import type { CmsMediaBlock } from "@/types/mediaBlock";
import { stories as seedStories } from "@/data/mock/stories";
import { siteConfig as seedSiteConfig } from "@/data/mock/site";
import { experiences as seedExperiences } from "@/data/mock/experiences";
import { vipPlans as seedVipPlans } from "@/data/mock/vip";
import { faqCategories as seedFaqCategories } from "@/data/mock/faq";
import { pageContent as seedPageContent } from "@/data/mock/pageContent";

import {
  historyValue as localHistoryValue,
  listHistory as localListHistory,
  loadDocuments,
  localValue,
  saveDocuments as localSaveDocuments,
  type LocalRevision,
} from "@/lib/cmsLocal";
import { supabase } from "@/lib/supabase";
import { documentKeys, validateDocument, type DocumentKey } from "@/lib/cmsValidation";

const CMS_CACHE_KEY = "afhomes.cms.supabase.v1";
const versions: Partial<Record<DocumentKey, number>> = {};

interface CachedStore {
  documents: Partial<Record<DocumentKey, unknown>>;
  versions: Partial<Record<DocumentKey, number>>;
}

function readCache(): CachedStore {
  try {
    const raw = localStorage.getItem(CMS_CACHE_KEY);
    if (!raw) return { documents: {}, versions: {} };
    const parsed = JSON.parse(raw) as Partial<CachedStore> & Partial<Record<DocumentKey, unknown>>;
    if (parsed.documents && typeof parsed.documents === "object") {
      return {
        documents: parsed.documents,
        versions: parsed.versions ?? {},
      };
    }
    const documents: Partial<Record<DocumentKey, unknown>> = {};
    for (const key of documentKeys) {
      if (key in parsed) documents[key] = parsed[key];
    }
    return { documents, versions: {} };
  } catch {
    return { documents: {}, versions: {} };
  }
}

function writeCache(store: CachedStore) {
  localStorage.setItem(CMS_CACHE_KEY, JSON.stringify(store));
}

function readCachedDocument<T>(key: DocumentKey, fallback: T): T {
  const candidate = !supabase ? localValue(key) ?? fallback : readCache().documents[key] ?? fallback;

  try {
    return structuredClone(validateDocument(key, candidate) as T);
  } catch {
    return structuredClone(fallback);
  }
}

function applySavedRows(rows: Array<{ key: string; value: unknown; revision: number }>) {
  const store = readCache();
  for (const row of rows) {
    const key = row.key as DocumentKey;
    store.documents[key] = row.value;
    store.versions[key] = row.revision;
    versions[key] = row.revision;
  }
  writeCache(store);
  window.dispatchEvent(new Event("afhomes-cms-updated"));
}

function mapSaveError(message: string) {
  if (message.includes("Content conflict")) {
    return new Error("Content changed elsewhere. Reload before saving to avoid overwriting it.");
  }
  if (message.includes("Administrator access required")) {
    return new Error("Administrator access is required to save website content.");
  }
  return new Error(message);
}

async function hydrateSupabaseDocuments(): Promise<void> {
  if (!supabase) {
    await loadDocuments();
    return;
  }

  const { data, error } = await supabase.from("cms_documents").select("key, value, revision");
  if (error) throw new Error(error.message);

  const store: CachedStore = { documents: {}, versions: {} };
  for (const row of data ?? []) {
    if (row.key && row.value !== undefined) {
      const key = row.key as DocumentKey;
      store.documents[key] = row.value;
      store.versions[key] = row.revision ?? 0;
      versions[key] = row.revision ?? 0;
    }
  }
  writeCache(store);
}

export async function saveDocuments(changes: Partial<Record<DocumentKey, unknown>>): Promise<void> {
  const validated: Partial<Record<DocumentKey, unknown>> = {};
  for (const key of Object.keys(changes) as DocumentKey[]) {
    validated[key] = validateDocument(key, changes[key]);
  }

  if (!supabase) {
    await localSaveDocuments(validated);
    return;
  }

  const expected: Record<string, number> = {};
  for (const key of Object.keys(validated) as DocumentKey[]) {
    expected[key] = versions[key] ?? 0;
  }

  const { data, error } = await supabase.rpc("save_cms_documents", {
    changes: validated,
    expected,
  });
  if (error) throw mapSaveError(error.message);
  applySavedRows((data ?? []) as Array<{ key: string; value: unknown; revision: number }>);
}

async function write<T>(key: DocumentKey, value: T) {
  await saveDocuments({ [key]: value });
}

function read<T>(key: DocumentKey, fallback: T): T {
  return readCachedDocument(key, fallback);
}

export async function listHistory(page: number): Promise<LocalRevision[]> {
  if (!supabase) return localListHistory(page);

  const from = page * 25;
  const { data, error } = await supabase
    .from("cms_history")
    .select("id, key, revision, saved_at")
    .order("saved_at", { ascending: false })
    .range(from, from + 24);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    key: row.key as DocumentKey,
    value: null,
    revision: row.revision,
    saved_at: row.saved_at,
  }));
}

export async function historyValue(id: string): Promise<unknown> {
  if (!supabase) return localHistoryValue(id);

  const { data, error } = await supabase
    .from("cms_history")
    .select("value")
    .eq("id", Number(id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("This version is no longer available.");
  return data.value;
}

export async function seedRemoteDocumentsIfEmpty(): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase.from("cms_documents").select("key");
  if (error) throw new Error(error.message);
  if ((data ?? []).length > 0) return;

  await saveDocuments({
    site: structuredClone(seedSiteConfig),
    pageContent: structuredClone(seedPageContent),
    experiences: structuredClone(seedExperiences),
    vip: structuredClone(seedVipPlans),
    faq: structuredClone(seedFaqCategories),
    stories: [...seedStories],
    mediaBlocks: [],
  });
}

export const cmsRepository = {
  async hydrate(): Promise<void> {
    if (supabase) {
      await hydrateSupabaseDocuments();
      return;
    }

    await loadDocuments();
  },
  getStories(): Story[] {
    return this.getAllStories().filter((story) => !story.archived);
  },

  getAllStories(): Story[] {
    return read("stories", [...seedStories]);
  },

  async saveStory(story: Story): Promise<Story> {
    const current = this.getAllStories();
    const existingIndex = current.findIndex((item) => item.id === story.id);
    const nextStories = [...current];

    if (existingIndex >= 0) {
      nextStories[existingIndex] = story;
    } else {
      nextStories.unshift(story);
    }

    await write("stories", nextStories);
    return story;
  },

  deleteStory(id: string) {
    return write("stories", this.getAllStories().filter((story) => story.id !== id));
  },

  replaceStories(nextStories: Story[]) {
    return write("stories", nextStories);
  },

  resetStories() {
    return write("stories", [...seedStories]);
  },

  getSiteConfig(): SiteConfig {
    return read("site", structuredClone(seedSiteConfig));
  },

  saveSiteConfig(config: SiteConfig) {
    return write("site", config);
  },

  getExperiences(): Experience[] {
    return this.getAllExperiences().filter((experience) => !experience.archived);
  },

  getAllExperiences(): Experience[] {
    return read("experiences", structuredClone(seedExperiences));
  },

  saveExperiences(items: Experience[]) {
    return write("experiences", items);
  },

  getVipPlans(): VipPlan[] {
    return this.getAllVipPlans().filter((plan) => !plan.archived);
  },

  getAllVipPlans(): VipPlan[] {
    return read("vip", structuredClone(seedVipPlans));
  },

  saveVipPlans(items: VipPlan[]) {
    return write("vip", items);
  },

  getFaqCategories(): FaqCategory[] {
    return this.getAllFaqCategories()
      .filter((category) => !category.archived)
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => !item.archived),
      }));
  },

  getAllFaqCategories(): FaqCategory[] {
    return read("faq", structuredClone(seedFaqCategories));
  },

  saveFaqCategories(items: FaqCategory[]) {
    return write("faq", items);
  },

  getPageContent(): PageContent {
    const saved = read("pageContent", structuredClone(seedPageContent));
    return Object.fromEntries(
      Object.entries(seedPageContent).map(([section, defaults]) => [
        section,
        { ...defaults, ...(saved[section as keyof PageContent] ?? {}) },
      ]),
    ) as unknown as PageContent;
  },

  savePageContent(content: PageContent) {
    return write("pageContent", content);
  },

  getMediaBlocks(): CmsMediaBlock[] {
    return read("mediaBlocks", []);
  },

  saveMediaBlocks(blocks: CmsMediaBlock[]) {
    return write("mediaBlocks", blocks);
  },
};
