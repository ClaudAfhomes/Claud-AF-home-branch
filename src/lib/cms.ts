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
  type HistoryFilters,
  type LocalRevision,
} from "@/lib/cmsLocal";
import { supabase } from "@/lib/supabase";
import { documentKeys, validateDocument, type DocumentKey } from "@/lib/cmsValidation";
import {
  auditActorName,
  buildAuditRecord,
  buildRestoreSummary,
  documentLabels,
  formatSummaryWithActor,
  isGenericAuditSummary,
  philippineDateBoundary,
  type AuditAction,
  type AuditChange,
} from "@/lib/cmsAudit";

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

export interface SaveDocumentOptions {
  actionType?: LocalRevision["action_type"];
  summaries?: Partial<Record<DocumentKey, string>>;
}

async function currentAuditActor() {
  if (!supabase) return "Local administrator";
  const { data } = await supabase.auth.getUser();
  const metadata = data.user?.user_metadata ?? {};
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : "";
  return auditActorName(fullName, data.user?.email, data.user?.id);
}

export async function saveDocuments(changes: Partial<Record<DocumentKey, unknown>>, options: SaveDocumentOptions = {}): Promise<void> {
  const validated: Partial<Record<DocumentKey, unknown>> = {};
  for (const key of Object.keys(changes) as DocumentKey[]) {
    validated[key] = validateDocument(key, changes[key]);
  }
  const actor = await currentAuditActor();
  const auditRecords = Object.fromEntries((Object.keys(validated) as DocumentKey[]).map((key) => {
    const previous = supabase ? readCache().documents[key] : localValue(key);
    return [key, buildAuditRecord(key, previous, validated[key], actor)];
  })) as Record<DocumentKey, ReturnType<typeof buildAuditRecord>>;
  const changeSummaries = Object.fromEntries((Object.keys(validated) as DocumentKey[]).map((key) => [key, formatSummaryWithActor(options.summaries?.[key] ?? auditRecords[key].summary, actor)])) as Partial<Record<DocumentKey, string>>;
  const changeActions = Object.fromEntries((Object.keys(validated) as DocumentKey[]).map((key) => [key, options.actionType ?? auditRecords[key].action])) as Partial<Record<DocumentKey, LocalRevision["action_type"]>>;
  const changeDetails = Object.fromEntries((Object.keys(validated) as DocumentKey[]).map((key) => [key, auditRecords[key].changes])) as Partial<Record<DocumentKey, AuditChange[]>>;
  const changeCounts = Object.fromEntries((Object.keys(validated) as DocumentKey[]).map((key) => [key, auditRecords[key].changeCount])) as Partial<Record<DocumentKey, number>>;

  if (!supabase) {
    await localSaveDocuments(validated, changeSummaries, changeActions, changeDetails, changeCounts);
    return;
  }

  const expected: Record<string, number> = {};
  for (const key of Object.keys(validated) as DocumentKey[]) {
    expected[key] = versions[key] ?? 0;
  }

  let result = await supabase.rpc("save_cms_documents", {
    changes: validated,
    expected,
    change_summaries: changeSummaries,
    change_actions: changeActions,
    change_details: changeDetails,
    change_counts: changeCounts,
  });
  if (result.error && (result.error.code === "PGRST202" || result.error.message.includes("change_details") || result.error.message.includes("change_counts"))) {
    result = await supabase.rpc("save_cms_documents", { changes: validated, expected, change_summaries: changeSummaries, change_actions: changeActions });
  }
  if (result.error && (result.error.code === "PGRST202" || result.error.message.includes("change_actions"))) {
    result = await supabase.rpc("save_cms_documents", { changes: validated, expected, change_summaries: changeSummaries });
  }
  if (result.error && (result.error.code === "PGRST202" || result.error.message.includes("Could not find the function"))) {
    result = await supabase.rpc("save_cms_documents", { changes: validated, expected });
  }
  const { data, error } = result;
  if (error) throw mapSaveError(error.message);
  applySavedRows((data ?? []) as Array<{ key: string; value: unknown; revision: number }>);
}

async function write<T>(key: DocumentKey, value: T) {
  await saveDocuments({ [key]: value });
}

function read<T>(key: DocumentKey, fallback: T): T {
  return readCachedDocument(key, fallback);
}

export async function listHistory(page: number, filters: HistoryFilters = {}): Promise<LocalRevision[]> {
  if (!supabase) return localListHistory(page, filters);
  const cmsClient = supabase;

  const from = page * 25;
  const queryHistory = async (columns: string) => {
    let query = cmsClient
      .from("cms_history")
      .select(columns)
      .order("saved_at", { ascending: false })
      .range(from, from + 24);
    if (filters.key) query = query.eq("key", filters.key);
    if (filters.action) query = query.eq("action_type", filters.action);
    if (filters.user) {
      const userFilter = filters.user.replace(/[%_,]/g, "");
      query = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userFilter)
        ? query.eq("saved_by", userFilter)
        : query.ilike("saved_by_email", `%${userFilter}%`);
    }
    if (filters.search) query = query.ilike("change_summary", `%${filters.search.replace(/[%_,]/g, "")}%`);
    if (filters.dateFrom) query = query.gte("saved_at", philippineDateBoundary(filters.dateFrom));
    if (filters.dateTo) query = query.lte("saved_at", philippineDateBoundary(filters.dateTo, true));
    return await query;
  };
  interface HistoryRow {
    id: string | number;
    key: string;
    revision: number;
    saved_at: string;
    saved_by?: string | null;
    saved_by_email?: string | null;
    action_type?: string;
    change_summary?: string | null;
    change_details?: unknown;
    change_count?: number;
    content_revision?: number;
    value: unknown;
    after_value?: unknown;
  }
  const primary = await queryHistory("id, key, revision, content_revision, saved_at, saved_by, saved_by_email, action_type, change_summary, change_details, change_count, value, after_value");
  let data = (primary.data ?? []) as unknown as HistoryRow[];
  let historyError = primary.error;
  if (historyError?.code === "42703") {
    const previousSchema = await queryHistory("id, key, revision, saved_at, saved_by, saved_by_email, action_type, change_summary, value, after_value");
    data = (previousSchema.data ?? []) as unknown as HistoryRow[];
    historyError = previousSchema.error;
  }
  if (historyError?.code === "42703") {
    const legacy = await queryHistory("id, key, revision, saved_at, saved_by, change_summary, value");
    data = (legacy.data ?? []) as unknown as HistoryRow[];
    historyError = legacy.error;
  }
  if (historyError) throw new Error(historyError.message);

  return data.map((row) => {
    const key = row.key as DocumentKey;
    const fallbackAudit = row.after_value == null ? undefined : buildAuditRecord(key, row.value, row.after_value);
    const genericSummary = isGenericAuditSummary(row.change_summary);
    const actor = auditActorName(undefined, row.saved_by_email, row.saved_by);
    const fallbackSummary = fallbackAudit
      ? formatSummaryWithActor(fallbackAudit.summary, actor)
      : `${actor} updated ${documentLabels[key].toLowerCase()}.`;
    const allowedActions: AuditAction[] = ["created", "updated", "deleted", "archived", "restored", "published", "unpublished"];
    const storedAction = allowedActions.find((action) => action === row.action_type);
    return {
      id: String(row.id),
      key,
      value: row.value,
      after_value: row.after_value,
      revision: row.revision,
      content_revision: row.content_revision ?? row.revision + 1,
      saved_at: row.saved_at,
      saved_by: row.saved_by ?? null,
      saved_by_email: row.saved_by_email ?? null,
      action_type: (genericSummary ? fallbackAudit?.action : storedAction) ?? storedAction ?? fallbackAudit?.action ?? "updated",
      change_summary: genericSummary ? fallbackSummary : row.change_summary ?? fallbackSummary,
      change_details: Array.isArray(row.change_details) && row.change_details.length > 0
        ? row.change_details as AuditChange[]
        : fallbackAudit?.changes,
      change_count: row.change_count ?? fallbackAudit?.changeCount,
    };
  });
}

export async function restoreHistorySnapshot(row: LocalRevision): Promise<void> {
  const snapshot = await historyValue(row.id);
  await saveDocuments(
    { [row.key]: snapshot },
    {
      actionType: "restored",
      summaries: { [row.key]: buildRestoreSummary(row.key, row.revision, row.saved_at) },
    },
  );
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
    const stored = !supabase ? localValue("pageContent") : readCache().documents.pageContent;
    const saved = stored && typeof stored === "object" ? stored as Partial<PageContent> : {};
    const merged = Object.fromEntries(
      Object.entries(seedPageContent).map(([section, defaults]) => [
        section,
        { ...defaults, ...(saved[section as keyof PageContent] ?? {}) },
      ]),
    ) as unknown as PageContent;
    return structuredClone(validateDocument("pageContent", merged) as PageContent);
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
