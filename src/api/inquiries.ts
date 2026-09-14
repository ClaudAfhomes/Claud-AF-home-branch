import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export type InquiryStatus = "new" | "contacted" | "confirmed" | "closed";
export interface InquiryRecord {
  id: string; created_at: string; name: string; email: string; contact_number: string;
  inquiry_type: string; message: string; kind: "inquiry" | "reservation";
  visit_date: string | null; end_date: string | null; guests: number | null;
  status: InquiryStatus; notes: string;
  archived_at?: string | null;
}
const KEY = "afhomes.inquiries.v1";
export function readInquiries(): InquiryRecord[] {
  return JSON.parse(localStorage.getItem(KEY) ?? "[]") as InquiryRecord[];
}
export function storeInquiry(record: InquiryRecord) {
  const records = readInquiries();
  if (records.some((item) => item.id === record.id)) return;
  try { localStorage.setItem(KEY, JSON.stringify([record, ...records])); }
  catch { throw new Error("Browser storage is full or unavailable. Your request was not saved."); }
}
export const inquiriesApi = {
  async list(page: number, status: string, archived = false) {
    if (supabase) {
      const from = page * 20;
      let query = supabase
        .from("inquiries")
        .select("*", { count: "exact" })
        .filter("archived_at", archived ? "not.is" : "is", null)
        .order("created_at", { ascending: false })
        .range(from, from + 19);
      if (status) query = query.eq("status", status);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { records: (data ?? []) as InquiryRecord[], total: count ?? 0 };
    }

    const records = readInquiries().filter((record) => Boolean(record.archived_at) === archived && (!status || record.status === status));
    return { records: records.slice(page * 20, page * 20 + 20), total: records.length };
  },
  async update(id: string, status: InquiryStatus, notes: string) {
    if (notes.length > 5000) throw new Error("Notes must be 5,000 characters or fewer.");
    if (supabase) {
      const { data, error } = await supabase
        .from("inquiries")
        .update({ status, notes })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Request not found.");
      return;
    }

    const records = readInquiries();
    if (!records.some((record) => record.id === id)) throw new Error("Request not found.");
    try { localStorage.setItem(KEY, JSON.stringify(records.map((record) => record.id === id ? { ...record, status, notes } : record))); }
    catch { throw new Error("Browser storage is full or unavailable. Changes were not saved."); }
  },
  async archive(id: string, archived: boolean) {
    const archivedAt = archived ? new Date().toISOString() : null;
    if (supabase) {
      const { data, error } = await supabase.from("inquiries").update({ archived_at: archivedAt }).eq("id", id).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Request not found.");
      return;
    }
    const records = readInquiries();
    if (!records.some((record) => record.id === id)) throw new Error("Request not found.");
    localStorage.setItem(KEY, JSON.stringify(records.map((record) => record.id === id ? { ...record, archived_at: archivedAt } : record)));
  },
};

export const inquiriesAreRemote = hasSupabaseConfig;
