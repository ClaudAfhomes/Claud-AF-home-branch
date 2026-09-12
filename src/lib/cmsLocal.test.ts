import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildAuditRecord, buildRestoreSummary } from "./cmsAudit.ts";
import { loadDocuments, listHistory, saveDocuments } from "./cmsLocal.ts";

const STORAGE_KEY = "afhomes.cms.store.v1";

function installBrowserGlobals() {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return memory.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        memory.set(key, value);
      },
      removeItem(key: string) {
        memory.delete(key);
      },
      clear() {
        memory.clear();
      },
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { dispatchEvent() { /* cms change notification */ } },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
}

const faq = [
  { id: "afhomes", label: "About AFhomes", items: [{ question: "Who is the AFhomes Group?", answer: "AFhomes is a hospitality group." }] },
];

describe("local CMS restore history", () => {
  afterEach(() => {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  });

  it("creates a detailed restore-history entry after restoring a snapshot", async () => {
    installBrowserGlobals();
    await loadDocuments();
    const created = buildAuditRecord("faq", undefined, faq, "Claud");
    await saveDocuments({ faq }, { faq: created.summary }, { faq: "created" }, { faq: created.changes }, { faq: created.changeCount });

    const updatedFaq = [{
      id: "afhomes",
      label: "About AFhomes",
      items: [
        { question: "Who is the AFhomes Group?", answer: "AFhomes is a hospitality group." },
        { question: "Is parking available?", answer: "Yes, parking is available on site." },
      ],
    }];
    const updated = buildAuditRecord("faq", faq, updatedFaq, "Claud");
    await saveDocuments({ faq: updatedFaq }, { faq: updated.summary }, { faq: updated.action }, { faq: updated.changes }, { faq: updated.changeCount });

    const latest = (await listHistory(0))[0];
    assert.ok(latest);
    const restoreSummary = buildRestoreSummary("faq", latest.revision, latest.saved_at, "Claud");
    const restoredAudit = buildAuditRecord("faq", updatedFaq, faq, "Claud");
    await saveDocuments(
      { faq },
      { faq: restoreSummary },
      { faq: "restored" },
      { faq: restoredAudit.changes },
      { faq: restoredAudit.changeCount },
    );

    const restoreRow = (await listHistory(0))[0];
    assert.equal(restoreRow?.action_type, "restored");
    assert.match(restoreRow?.change_summary ?? "", /Claud restored FAQs to version /);
    assert.equal(restoreRow?.change_details?.some((change) => change.operation === "deleted" && change.item === "Is parking available?"), true);
  });

  it("does not create history when document validation fails", async () => {
    installBrowserGlobals();
    await loadDocuments();
    await assert.rejects(
      saveDocuments(
        { faq: [{ id: "invalid", label: "", items: [] }] },
        { faq: "This save must fail." },
      ),
    );
    assert.equal((await listHistory(0)).length, 0);
  });

  it("reconstructs details for older generic history rows", async () => {
    installBrowserGlobals();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      documents: { site: { phoneDisplay: "222" } },
      versions: { site: 2 },
      history: [{
        id: "legacy-row",
        key: "site",
        value: { phoneDisplay: "111" },
        after_value: { phoneDisplay: "222" },
        revision: 1,
        saved_at: "2026-09-12T07:45:00.000Z",
        saved_by: "local-admin",
        saved_by_email: "claud@example.com",
        action_type: "updated",
        change_summary: "Content updated.",
      }],
    }));

    const legacy = (await listHistory(0))[0];
    assert.ok(legacy);
    assert.notEqual(legacy.change_summary, "Content updated.");
    assert.match(legacy.change_summary, /Claud changed the main contact number from `111` to `222`/);
    assert.equal(legacy.change_details?.[0]?.label, "Main contact number");
  });
});
