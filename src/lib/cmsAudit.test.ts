import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAuditRecord,
  buildRestoreSummary,
  changeStatusLabel,
  displayAuditValue,
  isImageSrcChange,
  MAX_AUDIT_CHANGES,
  philippineDateBoundary,
  sanitizeAuditValue,
} from "./cmsAudit.ts";

describe("CMS audit history", () => {
  it("records text-field before and after values in human-readable language", () => {
    const audit = buildAuditRecord(
      "site",
      { phoneDisplay: "+63 960-431-6867" },
      { phoneDisplay: "+63 917-000-0000" },
      "Claud",
    );
    assert.equal(audit.action, "updated");
    assert.match(audit.summary, /Claud changed the main contact number from `\+63 960-431-6867` to `\+63 917-000-0000`\./i);
    assert.equal(audit.changes[0]?.path, "site.phoneDisplay");
    assert.equal(audit.changes[0]?.label, "Main contact number");
    assert.equal(audit.changes[0]?.before, "+63 960-431-6867");
    assert.equal(audit.changes[0]?.after, "+63 917-000-0000");
  });

  it("records image replacement as Image replaced instead of a raw URL-only summary", () => {
    const audit = buildAuditRecord(
      "experiences",
      [{ id: "smart-wellness-hotel", shortName: "Smart Wellness Hotel", image: { src: "https://cdn.example/old.jpg", alt: "Hotel lobby" } }],
      [{ id: "smart-wellness-hotel", shortName: "Smart Wellness Hotel", image: { src: "https://cdn.example/new.jpg", alt: "Hotel lobby" } }],
      "Claud",
    );
    const imageChange = audit.changes.find((change) => change.path.endsWith(".src"));
    assert.ok(imageChange);
    assert.equal(isImageSrcChange(imageChange), true);
    assert.equal(changeStatusLabel(imageChange), "Image replaced");
    assert.match(audit.summary, /Claud replaced the Smart Wellness Hotel image\./);
    assert.equal(imageChange.before, "https://cdn.example/old.jpg");
    assert.equal(imageChange.after, "https://cdn.example/new.jpg");

    const altAudit = buildAuditRecord(
      "experiences",
      [{ id: "smart-wellness-hotel", shortName: "Smart Wellness Hotel", image: { src: "https://cdn.example/new.jpg", alt: "Hotel lobby" } }],
      [{ id: "smart-wellness-hotel", shortName: "Smart Wellness Hotel", image: { src: "https://cdn.example/new.jpg", alt: "Smart Wellness Hotel exterior" } }],
      "Claud",
    );
    const altChange = altAudit.changes.find((change) => change.path.endsWith(".alt"));
    assert.ok(altChange);
    assert.equal(altChange.value_type, undefined);
    assert.equal(displayAuditValue(altChange.before, altChange), "Hotel lobby");
    assert.equal(altAudit.summary, "Claud changed the alt text of the Smart Wellness Hotel image from `Hotel lobby` to `Smart Wellness Hotel exterior`.");
  });

  it("records featured status updates", () => {
    const before = [{ id: "hotspring", shortName: "Hotspring & Ecofarm Resort", featured: false }];
    const after = [{ id: "hotspring", shortName: "Hotspring & Ecofarm Resort", featured: true }];
    const featured = buildAuditRecord("experiences", before, after, "Claud");
    assert.match(featured.summary, /Claud featured the experience: `Hotspring & Ecofarm Resort`\./);
    assert.equal(featured.changes[0]?.operation, "enabled");
    assert.equal(featured.changes[0]?.before, false);
    assert.equal(featured.changes[0]?.after, true);

    const unfeatured = buildAuditRecord(
      "experiences",
      [{ id: "alm", shortName: "ALM Japanese Restaurant", featured: true }],
      [{ id: "alm", shortName: "ALM Japanese Restaurant", featured: false }],
      "Claud",
    );
    assert.match(unfeatured.summary, /Claud removed Featured status from: `ALM Japanese Restaurant`\./);
  });

  it("records FAQ additions and deletions", () => {
    const before = [{ id: "afhomes", label: "About", items: [{ question: "Old sample question", answer: "Old answer" }] }];
    const added = buildAuditRecord(
      "faq",
      before,
      [{ id: "afhomes", label: "About", items: [{ question: "Old sample question", answer: "Old answer" }, { question: "Is parking available?", answer: "Yes, parking is available." }] }],
      "Claud",
    );
    assert.match(added.summary, /Claud added a new FAQ: `Is parking available\?`\./);
    assert.equal(added.changes[0]?.operation, "created");

    const deleted = buildAuditRecord(
      "faq",
      before,
      [{ id: "afhomes", label: "About", items: [] }],
      "Claud",
    );
    assert.match(deleted.summary, /Claud deleted the FAQ: `Old sample question`\./);
    assert.equal(deleted.changes[0]?.operation, "deleted");
  });

  it("records list reorder with previous and new positions", () => {
    const hotel = { id: "hotel", shortName: "Smart Wellness Hotel" };
    const alm = { id: "alm", shortName: "ALM Japanese Restaurant" };
    const resort = { id: "resort", shortName: "Hotspring & Ecofarm Resort" };
    const audit = buildAuditRecord("experiences", [alm, resort, hotel], [hotel, alm, resort], "Claud");
    const hotelMove = audit.changes.find((change) => change.item === "Smart Wellness Hotel" && change.operation === "reordered");
    assert.ok(hotelMove);
    assert.equal(hotelMove.before, 3);
    assert.equal(hotelMove.after, 1);
    assert.match(audit.summary, /display order of `Smart Wellness Hotel` from position 3 to position 1/);

    const explicitOrder = buildAuditRecord(
      "site",
      { socialLinks: [{ id: "facebook", label: "Facebook", sortOrder: 0 }] },
      { socialLinks: [{ id: "facebook", label: "Facebook", sortOrder: 2 }] },
    );
    assert.equal(explicitOrder.changes[0]?.before, 1);
    assert.equal(explicitOrder.changes[0]?.after, 3);
  });

  it("distinguishes primitive list additions and removals from edits", () => {
    const added = buildAuditRecord(
      "pageContent",
      { home: { highlights: ["Breakfast", "Pool"] } },
      { home: { highlights: ["Breakfast", "Parking", "Pool"] } },
    );
    assert.equal(added.changes.length, 1);
    assert.equal(added.changes[0]?.operation, "created");
    assert.equal(added.changes[0]?.after, "Parking");

    const removed = buildAuditRecord(
      "pageContent",
      { home: { highlights: ["Breakfast", "Parking", "Pool"] } },
      { home: { highlights: ["Breakfast", "Pool"] } },
    );
    assert.equal(removed.changes.length, 1);
    assert.equal(removed.changes[0]?.operation, "deleted");
    assert.equal(removed.changes[0]?.before, "Parking");
  });

  it("derives publish, unpublish, archive, and restore actions", () => {
    assert.equal(buildAuditRecord("stories", [{ id: "story", title: "News", published: false }], [{ id: "story", title: "News", published: true }]).action, "published");
    assert.equal(buildAuditRecord("stories", [{ id: "story", title: "News", published: true }], [{ id: "story", title: "News", published: false }]).action, "unpublished");
    assert.equal(buildAuditRecord("stories", [{ id: "story", title: "News", archived: false }], [{ id: "story", title: "News", archived: true }]).action, "archived");
    assert.equal(buildAuditRecord("stories", [{ id: "story", title: "News", archived: true }], [{ id: "story", title: "News", archived: false }]).action, "restored");
  });

  it("caps displayed detail while retaining the total change count", () => {
    const before = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`field${index}`, `old-${index}`]));
    const after = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`field${index}`, `new-${index}`]));
    const audit = buildAuditRecord("site", before, after);
    assert.equal(audit.changes.length, MAX_AUDIT_CHANGES);
    assert.equal(audit.changeCount, 60);
    assert.match(audit.summary, /59 additional changes were recorded/);
  });

  it("uses Philippine-time date boundaries for history filters", () => {
    assert.equal(philippineDateBoundary("2026-09-12"), "2026-09-11T16:00:00.000Z");
    assert.equal(philippineDateBoundary("2026-09-12", true), "2026-09-12T15:59:59.999Z");
  });

  it("builds a restore summary with Philippine time and never includes sensitive fields", () => {
    const restore = buildRestoreSummary("site", 18, "2026-09-12T07:45:00.000Z", "Claud");
    assert.match(restore, /Claud restored Settings to version 18 created on September 12, 2026 at 3:45 PM/);

    const audit = buildAuditRecord(
      "site",
      { phoneDisplay: "111", password: "old-secret", resetToken: "old-token", apiKey: "old-key", nested: { clientSecret: "old-client-secret" } },
      { phoneDisplay: "222", password: "new-secret", resetToken: "new-token", apiKey: "new-key", nested: { clientSecret: "new-client-secret" } },
      "Claud",
    );
    assert.equal(audit.changes.some((change) => /password|token|apiKey|secret/i.test(change.path) || /password|token|key/i.test(change.label)), false);
    assert.deepEqual(sanitizeAuditValue({ password: "x", phoneDisplay: "111", nested: { accessToken: "abc" } }), { phoneDisplay: "111", nested: {} });
    assert.equal(JSON.stringify(audit.changes).includes("new-secret"), false);
    assert.equal(JSON.stringify(audit.changes).includes("new-token"), false);
    assert.equal(JSON.stringify(audit.changes).includes("new-key"), false);
    assert.equal(JSON.stringify(audit.changes).includes("new-client-secret"), false);
  });
});
