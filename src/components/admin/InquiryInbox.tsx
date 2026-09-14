import { useState } from "react";
import { inquiryService } from "@/services/inquiryService";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { InquiryRecord, InquiryStatus } from "@/api/inquiries";
import { useAsync } from "@/hooks/useAsync";
import { ErrorState, LoadingState } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AdminIcon } from "@/components/admin/AdminIcon";
import { confirmAction } from "@/lib/dialog";
import { downloadJson } from "@/components/admin/BackupPanel";

const statuses: InquiryStatus[] = ["new", "contacted", "confirmed", "closed"];
const PAGE_SIZE = 20;
const statusTone: Record<InquiryStatus, "leaf" | "cyan" | "gold" | "neutral"> = {
  new: "leaf", contacted: "cyan", confirmed: "gold", closed: "neutral",
};
const titleCase = (value: string) => value.replace(/^./, (character) => character.toUpperCase());

export function InquiryInbox() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const { data, loading, error, retry } = useAsync(() => inquiryService.list(page, status, archived), [page, status, archived]);
  const records = data?.records ?? [];
  const total = data?.total ?? 0;
  const firstRecord = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRecord = Math.min((page + 1) * PAGE_SIZE, total);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-soft">
      <header className="border-b border-line px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="label-caps text-leaf-700">Guest relations</p>
            <h2 className="font-display mt-2 text-4xl font-medium text-navy-900">Inquiry inbox</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-600">
              {hasSupabaseConfig
                ? "Review requests saved in the AFhomes database, follow up with each guest, and keep their progress current."
                : "Review requests saved in this browser, follow up with each guest, and keep their progress current."}
            </p>
          </div>
          <div className="rounded-xl border border-leaf-300 bg-leaf-100 px-4 py-3 text-sm text-pine-900">
            <strong>{total}</strong> total request{total === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-cream-100/60 px-5 py-4 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_auto_auto_auto] sm:items-end">
          <label className="block sm:max-w-xs">
            <span className="label-caps text-ink-500">Filter by status</span>
            <select aria-label="Filter requests by status" className="cms-input mt-1.5 py-2.5" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }}>
              <option value="">All requests</option>
              {statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => { setPage(0); setArchived((value) => !value); }}>{archived ? "View active" : "View archive"}</Button>
          <Button className="w-full sm:w-auto" size="sm" onClick={retry}>Refresh inbox</Button>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" disabled={!records.length} onClick={() => downloadJson(records, "afhomes-inquiries-page.json")}>Export page</Button>
        </div>
      </div>

      <div className="p-5 sm:p-8">
        {loading ? <LoadingState label="Loading guest requests..." /> : error ? <ErrorState message={error.message} onRetry={retry} /> : records.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-cream-100/40 px-6 py-14 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-leaf-100 text-pine-800"><AdminIcon name="inbox" className="h-6 w-6" /></span>
            <h3 className="font-display mt-4 text-2xl text-navy-900">No requests found</h3>
            <p className="mt-2 text-sm text-ink-500">{status ? `There are no ${status} requests right now.` : "New guest requests will appear here."}</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
              <p className="text-sm font-semibold text-navy-900">Showing {firstRecord}–{lastRecord} of {total}</p>
              <p className="text-xs text-ink-400">Status updates are internal and do not contact the guest.</p>
            </div>
            <div className="space-y-4">
              {records.map((record) => <InquiryCard key={`${record.id}-${record.status}-${record.notes}-${record.archived_at}`} record={record} archived={archived} onSaved={retry} />)}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="text-sm font-semibold text-ink-500">Page {page + 1}</span>
              <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function InquiryCard({ record, archived, onSaved }: { record: InquiryRecord; archived: boolean; onSaved: () => void }) {
  const [status, setStatus] = useState(record.status);
  const [notes, setNotes] = useState(record.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hasChanges = status !== record.status || notes !== record.notes;

  const save = async () => {
    if (saving || !hasChanges) return;
    if (status === "confirmed" && record.status !== "confirmed" && !(await confirmAction("Confirm inquiry?", "Confirm availability and arrangements with this guest before continuing."))) return;
    setSaving(true);
    setError("");
    try { await inquiryService.update(record.id, status, notes); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed"); }
    finally { setSaving(false); }
  };
  const archive = async () => {
    const verb = archived ? "Restore" : "Archive";
    if (!(await confirmAction(`${verb} inquiry?`, archived ? "Return this request to the active inbox." : "Move this completed request out of the active inbox. It can be restored later."))) return;
    setSaving(true);
    setError("");
    try { await inquiryService.archive(record.id, !archived); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : `${verb} failed`); }
    finally { setSaving(false); }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-subtle transition-shadow hover:shadow-soft">
      <div className="border-b border-line bg-cream-100/50 px-5 py-4 sm:px-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl font-medium text-navy-900">{record.name}</h3>
              <Badge tone={statusTone[record.status]} className="capitalize">{record.status}</Badge>
              <Badge>{record.kind === "reservation" ? "Reservation" : "Inquiry"}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">{record.inquiry_type}</p>
          </div>
          <div className="text-left text-xs leading-relaxed text-ink-400 sm:text-right">
            <time dateTime={record.created_at}>{new Date(record.created_at).toLocaleString()}</time>
            <p className="font-mono">Ref {record.id}</p>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="space-y-5 p-5 sm:p-6 lg:border-r lg:border-line">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a className="font-semibold text-pine-800 underline decoration-leaf-500/40 underline-offset-4 hover:text-leaf-700" href={`mailto:${record.email}`}>{record.email}</a>
            <a className="font-semibold text-pine-800 underline decoration-leaf-500/40 underline-offset-4 hover:text-leaf-700" href={`tel:${record.contact_number}`}>{record.contact_number}</a>
          </div>
          {record.kind === "reservation" && (
            <div className="grid gap-3 rounded-xl bg-leaf-100/70 p-4 text-sm sm:grid-cols-2">
              <div><span className="label-caps text-ink-500">Visit</span><p className="mt-1 font-semibold text-navy-900">{record.visit_date}{record.end_date ? ` – ${record.end_date}` : ""}</p></div>
              <div><span className="label-caps text-ink-500">Party size</span><p className="mt-1 font-semibold text-navy-900">{record.guests} guest{record.guests === 1 ? "" : "s"}</p></div>
            </div>
          )}
          <div><p className="label-caps text-ink-500">Guest message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{record.message}</p></div>
        </div>
        <fieldset disabled={saving} className="space-y-4 bg-cream-100/30 p-5 sm:p-6">
          <label className="block"><span className="label-caps text-ink-500">Progress</span><select className="cms-input" value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)}>{statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
          <label className="block"><span className="label-caps text-ink-500">Internal notes</span><textarea rows={4} className="cms-input resize-y" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add follow-up details for the team" /></label>
          <div className="flex flex-col gap-2 sm:flex-row"><Button className="w-full sm:w-auto" size="sm" disabled={!hasChanges || saving} onClick={() => void save()}>{saving ? "Saving..." : hasChanges ? "Save changes" : "Up to date"}</Button><Button className="w-full sm:w-auto" variant="outline" size="sm" disabled={saving} onClick={() => void archive()}>{archived ? "Restore" : "Archive"}</Button></div>
          {error && <p role="alert" className="rounded-lg bg-coral-100 px-3 py-2 text-sm font-semibold text-coral-700">{error}</p>}
        </fieldset>
      </div>
    </article>
  );
}
