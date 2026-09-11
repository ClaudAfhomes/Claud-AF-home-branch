import { useState } from "react";
import { inquiryService } from "@/services/inquiryService";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { InquiryRecord, InquiryStatus } from "@/api/inquiries";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { downloadJson } from "@/components/admin/BackupPanel";

export function InquiryInbox() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const { data, loading, error, retry } = useAsync(() => inquiryService.list(page, status), [page, status]);
  return <section className="space-y-6"><h2 className="font-display text-3xl text-navy-900">Inquiries & reservation requests</h2><p>{hasSupabaseConfig ? "This inbox lists requests saved in the AFhomes database. Contact guests directly to arrange their visit. Changing a status here does not send a message or reserve inventory." : "This inbox contains requests saved in this browser only. Contact guests directly to arrange their visit. Changing a status here does not send a message or reserve inventory."}</p><div className="flex flex-wrap gap-4"><label>Status<select aria-label="Filter requests by status" className="cms-input" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }}><option value="">All</option>{["new", "contacted", "confirmed", "closed"].map((value) => <option key={value}>{value}</option>)}</select></label><Button onClick={retry}>Refresh inbox</Button><Button variant="outline" disabled={!data?.records.length} onClick={() => downloadJson(data?.records, "afhomes-inquiries-page.json")}>Export this page</Button></div>{loading ? <LoadingState /> : error ? <ErrorState message={error.message} onRetry={retry} /> : <><p>{data?.total ?? 0} requests</p>{data?.records.map((record) => <InquiryCard key={`${record.id}-${record.status}-${record.notes}`} record={record} onSaved={retry} />)}<div className="flex gap-4"><Button disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button disabled={(page + 1) * 20 >= (data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</Button></div></>}</section>;
}
function InquiryCard({ record, onSaved }: { record: InquiryRecord; onSaved: () => void }) {
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState(record.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <article className="space-y-4 border border-line bg-cream-50 p-6"><h3 className="font-display text-2xl">{record.name} · {record.kind}</h3><p className="text-sm">{new Date(record.created_at).toLocaleString()} · {record.inquiry_type} · Reference {record.id}</p><p><a className="text-pine-800 underline" href={`mailto:${record.email}`}>{record.email}</a> · {record.contact_number}</p>{record.kind === "reservation" && <p>Visit: {record.visit_date}{record.end_date ? ` to ${record.end_date}` : ""} · {record.guests} guests</p>}<p className="whitespace-pre-wrap">{record.message}</p><fieldset disabled={saving} className="space-y-3"><label className="block">Status<select className="cms-input" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)}>{["new", "contacted", "confirmed", "closed"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block">Internal notes<textarea className="cms-input" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label><Button onClick={async () => {
    if (saving) return;
    if (status === "confirmed" && record.status !== "confirmed" && !window.confirm("Have you confirmed availability and arrangements with this guest?")) return;
    setSaving(true); setError("");
    try { await inquiryService.update(record.id, status, notes); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed"); }
    finally { setSaving(false); }
  }}>{saving ? "Saving..." : "Save request"}</Button></fieldset>{error && <p role="alert" className="text-coral-700">{error}</p>}</article>;
}

