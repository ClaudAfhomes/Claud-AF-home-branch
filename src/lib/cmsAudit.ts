import type { DocumentKey } from "@/lib/cmsValidation";

export const MAX_AUDIT_CHANGES = 50;

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "archived"
  | "restored"
  | "published"
  | "unpublished";

export type AuditOperation =
  | "updated"
  | "created"
  | "deleted"
  | "reordered"
  | "enabled"
  | "disabled";

export interface AuditChange {
  path: string;
  label: string;
  operation: AuditOperation;
  before: unknown;
  after: unknown;
  value_type?: "image" | "url";
  item?: string;
  item_type?: string;
}

export interface AuditResult {
  changes: AuditChange[];
  changeCount: number;
  summary: string;
  action: AuditAction;
}

export const documentLabels: Record<DocumentKey, string> = {
  site: "Settings",
  pageContent: "Website content",
  experiences: "Rooms / experiences",
  vip: "VIP plans",
  faq: "FAQs",
  stories: "Stories",
  mediaBlocks: "Page media",
};

const fieldLabels: Record<string, string> = {
  phoneDisplay: "Main contact number",
  phone: "Contact phone link",
  email: "Contact email",
  businessName: "Business name",
  footerTitle: "Footer heading",
  footerEyebrow: "Footer eyebrow",
  footerNoticeTitle: "Footer notice heading",
  footerNoticeBody: "Footer notice",
  footerCopyright: "Footer copyright",
  heroTitle: "Homepage main heading",
  heroLede: "Homepage introduction",
  facebookResort: "Facebook Resort link",
  facebookCorporate: "Facebook Corporate link",
  youtube: "YouTube link",
  instagram: "Instagram link",
  openGraphImage: "Social sharing image",
  defaultSocialImage: "Default social sharing image",
  featured: "Featured status",
  archived: "Archived status",
  sortOrder: "Display order",
  sort_order: "Display order",
  is_visible: "Visibility",
  enabled: "Enabled status",
  published: "Published status",
  alt: "Alt text",
  src: "Image source",
  url: "Link",
  href: "Link",
  title: "Title",
  lede: "Introduction",
  question: "FAQ question",
  answer: "FAQ answer",
};

const pageLabels: Record<string, string> = {
  home: "Home page",
  about: "About page",
  compliance: "Compliance page",
  faq: "FAQ page",
  contact: "Contact page",
  experiences: "Experiences page",
  vip: "VIP page",
  stories: "Stories page",
};

const sensitiveKeyPattern =
  /(?:^|[_-])(password|passcode|secret|token|credential|api[_-]?key|private[_-]?key|access[_-]?key|authorization|cookie|session|jwt|otp|recovery)(?:$|[_-])/i;
const identifierFields = ["id", "slug", "question", "name", "title", "label", "number"] as const;

interface ComparisonContext {
  item?: string;
  itemType?: string;
  parent?: Record<string, unknown>;
  ignoreSortOrder?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEqual(before: unknown, after: unknown) {
  if (Object.is(before, after)) return true;
  try {
    return JSON.stringify(before) === JSON.stringify(after);
  } catch {
    return false;
  }
}

function humanize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function isSensitivePath(path: string) {
  return path
    .replace(/\[[^\]]*\]/g, ".")
    .split(".")
    .some((part) => sensitiveKeyPattern.test(part.replace(/([a-z])([A-Z])/g, "$1_$2")));
}

function compactLeaf(value: unknown): unknown {
  if (typeof value !== "string") return value ?? null;
  if (value.startsWith("data:")) {
    const kind = value.slice(5).split(";")[0] || "file";
    return `[embedded ${kind}]`;
  }
  if (value.length > 500) return `${value.slice(0, 200)}…`;
  return value;
}

export function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeAuditValue);
  if (!isRecord(value)) return compactLeaf(value);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSensitivePath(key))
      .map(([key, nested]) => [key, sanitizeAuditValue(nested)]),
  );
}

function itemName(value: unknown): string | undefined {
  if (!isRecord(value)) return typeof value === "string" ? value : undefined;
  for (const key of ["shortName", "name", "question", "title", "label", "caption", "slug"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  return undefined;
}

function itemTypeForPath(path: string) {
  if (path.includes(".items") && path.startsWith("faq")) return "FAQ";
  if (path.startsWith("faq")) return "FAQ category";
  if (path.startsWith("experiences")) return "experience";
  if (path.startsWith("stories")) return "story";
  if (path.startsWith("vip")) return "VIP plan";
  if (path.startsWith("mediaBlocks")) return "media section";
  if (path.includes("offices")) return "office";
  if (path.includes("socialLinks")) return "social link";
  return "item";
}

function pageNameFromMedia(parent?: Record<string, unknown>) {
  if (!parent || typeof parent.page !== "string") return undefined;
  if (parent.page === "/") return "Homepage";
  const segment = parent.page.split("/").filter(Boolean).at(-1);
  return segment ? humanize(segment) : undefined;
}

function imageLabel(path: string, key: string, context: ComparisonContext) {
  const parentKey = path.split(".").at(-2) ?? "";
  const subject = context.item;
  const mediaPage = pageNameFromMedia(context.parent);
  const isBackground = context.parent?.placement === "page-background";
  let label = "Image";

  if (isBackground && mediaPage) label = `${mediaPage} hero background image`;
  else if (parentKey === "logo") label = "Business logo";
  else if (parentKey === "brandImage") label = "Homepage brand image";
  else if (parentKey === "cover" && subject) label = `${subject} cover image`;
  else if (parentKey === "openGraphImage") label = "Social sharing image";
  else if (parentKey === "defaultSocialImage") label = "Default social sharing image";
  else if (parentKey === "favicon") label = "Favicon image";
  else if (subject) label = `${subject} image`;
  else if (parentKey && parentKey !== path.split(".")[0]) label = `${humanize(parentKey)} image`;

  return key === "alt" ? `Alt text of the ${label}` : label;
}

function isImageField(key: string, context: ComparisonContext) {
  const parentKey = (context.parent && Object.keys(context.parent).includes("alt") && Object.keys(context.parent).includes("src"))
    || key === "src"
    || key === "alt";
  if (!parentKey) return false;
  const parentName = Object.keys(context.parent ?? {});
  return key === "src" || key === "alt" || parentName.includes("src");
}

function friendlyLabel(path: string, key: string, context: ComparisonContext) {
  if ((key === "src" || key === "alt") && isImageField(key, context)) {
    return imageLabel(path, key, context);
  }
  const parts = path.replace(/\[[^\]]*\]/g, "").split(".");
  const page = parts[0] === "pageContent" ? pageLabels[parts[1]] : undefined;
  const parentKey = parts.at(-2);
  const base = fieldLabels[key]
    ?? (page
      ? `${page} ${humanize(key).toLowerCase()}`
      : parentKey && parentKey !== parts[0]
        ? `${humanize(parentKey)} ${humanize(key).toLowerCase()}`
        : humanize(key));
  return context.item ? `${base} — ${context.item}` : base;
}

function valueType(key: string, label: string): AuditChange["value_type"] {
  if (key === "src" || (key !== "alt" && /image/i.test(key))) return "image";
  if (/url|href|link/i.test(key) || /link/i.test(label)) return "url";
  return undefined;
}

function leafOperation(key: string, before: unknown, after: unknown): AuditOperation {
  if (before === undefined) return "created";
  if (after === undefined) return "deleted";
  if (key === "sortOrder" || key === "sort_order") return "reordered";
  if (typeof after === "boolean" && ["featured", "archived", "enabled", "published", "is_visible"].includes(key)) {
    return after ? "enabled" : "disabled";
  }
  return "updated";
}

function arrayIdentityField(before: unknown[], after: unknown[]) {
  const records = [...before, ...after].filter(isRecord);
  if (records.length !== before.length + after.length || records.length === 0) return undefined;

  for (const field of identifierFields) {
    const beforeValues = before.map((item) => (item as Record<string, unknown>)[field]);
    const afterValues = after.map((item) => (item as Record<string, unknown>)[field]);
    if (
      beforeValues.every((value) => typeof value === "string" && value.length > 0) &&
      afterValues.every((value) => typeof value === "string" && value.length > 0) &&
      new Set(beforeValues).size === beforeValues.length &&
      new Set(afterValues).size === afterValues.length
    ) return field;
  }
  return undefined;
}

function quote(value: unknown) {
  if (value === null || value === undefined || value === "") return "`blank`";
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
  const compact = text.length > 100 ? `${text.slice(0, 97)}…` : text;
  return `\`${compact}\``;
}

function baseChangeLabel(change: AuditChange) {
  return change.label.split(" — ")[0] ?? change.label;
}

function lowerFirst(value: string) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function describeChange(change: AuditChange) {
  if (change.operation === "reordered") {
    return `Changed the display order of ${quote(change.item ?? change.label)} from position ${String(change.before)} to position ${String(change.after)}.`;
  }
  if (change.path.endsWith(".featured")) {
    return change.after
      ? `Featured the ${change.item_type ?? "item"}: ${quote(change.item ?? change.label)}.`
      : `Removed Featured status from: ${quote(change.item ?? change.label)}.`;
  }
  if (change.path.endsWith(".archived")) {
    return change.after
      ? `Archived the ${change.item_type ?? "item"}: ${quote(change.item ?? change.label)}.`
      : `Restored the ${change.item_type ?? "item"}: ${quote(change.item ?? change.label)}.`;
  }
  if (change.path.endsWith(".published") || change.path.endsWith(".status")) {
    if (change.after === true || change.after === "published") {
      return `Published ${quote(change.item ?? change.label)}.`;
    }
    if (change.after === false || change.after === "draft") {
      return `Unpublished ${quote(change.item ?? change.label)}.`;
    }
  }
  if (change.operation === "created") {
    if (change.item_type === "FAQ") return `Added a new FAQ: ${quote(change.item ?? change.after)}.`;
    return `Added the ${change.item_type ?? change.label}${change.item ? `: ${quote(change.item)}` : ""}.`;
  }
  if (change.operation === "deleted") {
    if (change.item_type === "FAQ") return `Deleted the FAQ: ${quote(change.item ?? change.before)}.`;
    return `Removed the ${change.item_type ?? change.label}${change.item ? `: ${quote(change.item)}` : ""}.`;
  }
  const label = baseChangeLabel(change);
  if (isImageSrcChange(change)) {
    const imageName = change.item && change.label.startsWith(change.item) ? change.label : lowerFirst(change.label);
    return `Replaced the ${imageName}.`;
  }
  if (change.value_type === "url") {
    return change.item ? `Updated the ${lowerFirst(label)} for ${quote(change.item)}.` : `Updated the ${change.label}.`;
  }
  if (change.operation === "enabled") {
    return change.item ? `Enabled the ${lowerFirst(label)} for ${quote(change.item)}.` : `Enabled the ${change.label}.`;
  }
  if (change.operation === "disabled") {
    return change.item ? `Disabled the ${lowerFirst(label)} for ${quote(change.item)}.` : `Disabled the ${change.label}.`;
  }
  const labelAlreadyNamesItem = Boolean(
    change.item
    && !change.label.includes(" — ")
    && change.label.toLocaleLowerCase().includes(change.item.toLocaleLowerCase()),
  );
  return change.item && !labelAlreadyNamesItem
    ? `Changed the ${lowerFirst(label)} of ${quote(change.item)} from ${quote(change.before)} to ${quote(change.after)}.`
    : `Changed the ${lowerFirst(change.label)} from ${quote(change.before)} to ${quote(change.after)}.`;
}

export function isImageSrcChange(change: AuditChange) {
  return change.value_type === "image" && !change.path.endsWith(".alt") && change.operation !== "created" && change.operation !== "deleted";
}

export function buildAuditSummary(documentKey: DocumentKey, changes: AuditChange[], changeCount: number) {
  if (changeCount === 0) return `Saved ${documentLabels[documentKey]} without content changes.`;
  const first = changes.find((change) => change.operation === "reordered" && change.after === 1) ?? changes[0];
  if (!first) return `Updated ${documentLabels[documentKey]} with ${changeCount} recorded changes.`;
  const additional = Math.max(0, changeCount - 1);
  const suffix = additional ? ` ${additional} additional ${additional === 1 ? "change was" : "changes were"} recorded.` : "";
  return `${describeChange(first)}${suffix}`.slice(0, 1000);
}

export function deriveAuditAction(before: unknown, after: unknown, changes: AuditChange[]): AuditAction {
  if (before === undefined) return "created";
  if (after === undefined) return "deleted";
  if (changes.length > 0 && changes.every((change) => change.operation === "created")) return "created";
  if (changes.length > 0 && changes.every((change) => change.operation === "deleted")) return "deleted";
  if (changes.some((change) => change.path.endsWith(".archived") && change.after === true)) return "archived";
  if (changes.some((change) => change.path.endsWith(".archived") && change.after === false)) return "restored";
  if (changes.some((change) => /(?:^|\.)(?:published|status)$/.test(change.path) && (change.after === true || change.after === "published"))) return "published";
  if (changes.some((change) => /(?:^|\.)(?:published|status)$/.test(change.path) && (change.after === false || change.after === "draft"))) return "unpublished";
  return "updated";
}

export function compareCmsValues(documentKey: DocumentKey, before: unknown, after: unknown): Omit<AuditResult, "summary" | "action"> {
  const changes: AuditChange[] = [];
  let changeCount = 0;

  const addChange = (
    path: string,
    operation: AuditOperation,
    previous: unknown,
    next: unknown,
    context: ComparisonContext = {},
    labelOverride?: string,
  ) => {
    if (isSensitivePath(path)) return;
    changeCount += 1;
    if (changes.length >= MAX_AUDIT_CHANGES) return;
    const key = path.split(".").at(-1)?.replace(/\[.*$/, "") ?? path;
    const label = labelOverride ?? friendlyLabel(path, key, context);
    changes.push({
      path,
      label,
      operation,
      before: sanitizeAuditValue(previous),
      after: sanitizeAuditValue(next),
      value_type: valueType(key, label),
      item: context.item,
      item_type: context.itemType,
    });
  };

  const compareArray = (path: string, previous: unknown[], next: unknown[], context: ComparisonContext, depth: number) => {
    const identityField = arrayIdentityField(previous, next);
    if (identityField) {
      const previousById = new Map(previous.map((item) => [String((item as Record<string, unknown>)[identityField]), item]));
      const nextById = new Map(next.map((item) => [String((item as Record<string, unknown>)[identityField]), item]));

      for (const [identity, item] of previousById) {
        if (nextById.has(identity)) continue;
        const name = itemName(item) ?? identity;
        addChange(
          `${path}[${identity}]`,
          "deleted",
          item,
          undefined,
          { item: name, itemType: itemTypeForPath(path), parent: isRecord(item) ? item : undefined },
          `${humanize(itemTypeForPath(path))}: ${name}`,
        );
      }
      for (const [identity, item] of nextById) {
        if (previousById.has(identity)) continue;
        const name = itemName(item) ?? identity;
        addChange(
          `${path}[${identity}]`,
          "created",
          undefined,
          item,
          { item: name, itemType: itemTypeForPath(path), parent: isRecord(item) ? item : undefined },
          `${humanize(itemTypeForPath(path))}: ${name}`,
        );
      }
      const unchangedIds = [...previousById.keys()].filter((identity) => nextById.has(identity));
      const isPureReorder = previousById.size === nextById.size && unchangedIds.length === previousById.size;
      for (const identity of unchangedIds) {
        const previousItem = previousById.get(identity);
        const nextItem = nextById.get(identity);
        if (previousItem === undefined || nextItem === undefined) continue;
        const name = itemName(nextItem) ?? itemName(previousItem) ?? identity;
        const previousPosition = previous.findIndex((item) => String((item as Record<string, unknown>)[identityField]) === identity) + 1;
        const nextPosition = next.findIndex((item) => String((item as Record<string, unknown>)[identityField]) === identity) + 1;
        const itemContext: ComparisonContext = {
          item: name,
          itemType: itemTypeForPath(path),
          parent: isRecord(nextItem) ? nextItem : undefined,
          ignoreSortOrder: isPureReorder && previousPosition !== nextPosition,
        };
        compare(`${path}[${identity}]`, previousItem, nextItem, itemContext, depth + 1);
        if (!isPureReorder) continue;
        if (previousPosition !== nextPosition) {
          addChange(`${path}[${identity}].sortOrder`, "reordered", previousPosition, nextPosition, itemContext, `Display order of ${name}`);
        }
      }
      return;
    }

    if (previous.length === next.length) {
      const previousSet = previous.map((item) => JSON.stringify(item)).sort();
      const nextSet = next.map((item) => JSON.stringify(item)).sort();
      if (isEqual(previousSet, nextSet)) {
        previous.forEach((item, index) => {
          const nextPosition = next.findIndex((candidate) => isEqual(candidate, item));
          if (nextPosition >= 0 && nextPosition !== index) {
            addChange(
              `${path}[${index}].sortOrder`,
              "reordered",
              index + 1,
              nextPosition + 1,
              { ...context, item: itemName(item) ?? String(item), itemType: itemTypeForPath(path) },
              `Display order of ${itemName(item) ?? String(item)}`,
            );
          }
        });
        return;
      }
      previous.forEach((item, index) => compare(`${path}[${index}]`, item, next[index], { ...context, parent: isRecord(next[index]) ? next[index] : context.parent }, depth + 1));
      return;
    }

    if (previous.length * next.length <= 10_000) {
      const matrix = Array.from({ length: previous.length + 1 }, () => Array<number>(next.length + 1).fill(0));
      for (let previousIndex = previous.length - 1; previousIndex >= 0; previousIndex -= 1) {
        for (let nextIndex = next.length - 1; nextIndex >= 0; nextIndex -= 1) {
          matrix[previousIndex]![nextIndex] = isEqual(previous[previousIndex], next[nextIndex])
            ? (matrix[previousIndex + 1]?.[nextIndex + 1] ?? 0) + 1
            : Math.max(matrix[previousIndex + 1]?.[nextIndex] ?? 0, matrix[previousIndex]?.[nextIndex + 1] ?? 0);
        }
      }

      const matches: Array<[number, number]> = [];
      let previousIndex = 0;
      let nextIndex = 0;
      while (previousIndex < previous.length && nextIndex < next.length) {
        if (isEqual(previous[previousIndex], next[nextIndex])) {
          matches.push([previousIndex, nextIndex]);
          previousIndex += 1;
          nextIndex += 1;
        } else if ((matrix[previousIndex + 1]?.[nextIndex] ?? 0) >= (matrix[previousIndex]?.[nextIndex + 1] ?? 0)) {
          previousIndex += 1;
        } else {
          nextIndex += 1;
        }
      }

      let previousStart = 0;
      let nextStart = 0;
      const boundaries: Array<[number, number]> = [...matches, [previous.length, next.length]];
      for (const [previousEnd, nextEnd] of boundaries) {
        const paired = Math.min(previousEnd - previousStart, nextEnd - nextStart);
        for (let offset = 0; offset < paired; offset += 1) {
          const nextItem = next[nextStart + offset];
          compare(
            `${path}[${nextStart + offset}]`,
            previous[previousStart + offset],
            nextItem,
            { ...context, parent: isRecord(nextItem) ? nextItem : context.parent },
            depth + 1,
          );
        }
        for (let index = previousStart + paired; index < previousEnd; index += 1) {
          const previousItem = previous[index];
          addChange(`${path}[${index}]`, "deleted", previousItem, undefined, {
            item: itemName(previousItem),
            itemType: itemTypeForPath(path),
            parent: isRecord(previousItem) ? previousItem : undefined,
          });
        }
        for (let index = nextStart + paired; index < nextEnd; index += 1) {
          const nextItem = next[index];
          addChange(`${path}[${index}]`, "created", undefined, nextItem, {
            item: itemName(nextItem),
            itemType: itemTypeForPath(path),
            parent: isRecord(nextItem) ? nextItem : undefined,
          });
        }
        previousStart = previousEnd + 1;
        nextStart = nextEnd + 1;
      }
      return;
    }

    const sharedLength = Math.min(previous.length, next.length);
    for (let index = 0; index < sharedLength; index += 1) {
      const nextItem = next[index];
      compare(`${path}[${index}]`, previous[index], nextItem, { ...context, parent: isRecord(nextItem) ? nextItem : context.parent }, depth + 1);
    }
    for (let index = sharedLength; index < previous.length; index += 1) {
      const previousItem = previous[index];
      addChange(`${path}[${index}]`, "deleted", previousItem, undefined, { item: itemName(previousItem), itemType: itemTypeForPath(path), parent: isRecord(previousItem) ? previousItem : undefined });
    }
    for (let index = sharedLength; index < next.length; index += 1) {
      const nextItem = next[index];
      addChange(`${path}[${index}]`, "created", undefined, nextItem, { item: itemName(nextItem), itemType: itemTypeForPath(path), parent: isRecord(nextItem) ? nextItem : undefined });
    }
  };

  const compare = (path: string, previous: unknown, next: unknown, context: ComparisonContext, depth: number) => {
    if (isEqual(previous, next) || isSensitivePath(path)) return;
    if (depth > 20) {
      addChange(path, "updated", previous, next, context);
      return;
    }
    if (Array.isArray(previous) || Array.isArray(next)) {
      compareArray(path, Array.isArray(previous) ? previous : [], Array.isArray(next) ? next : [], context, depth);
      return;
    }
    if (isRecord(previous) || isRecord(next)) {
      const previousRecord = isRecord(previous) ? previous : {};
      const nextRecord = isRecord(next) ? next : {};
      const keys = new Set([...Object.keys(previousRecord), ...Object.keys(nextRecord)]);
      for (const key of keys) {
        if ((key === "sortOrder" || key === "sort_order") && context.ignoreSortOrder) continue;
        const parent = Object.keys(nextRecord).length ? nextRecord : previousRecord;
        compare(`${path}.${key}`, previousRecord[key], nextRecord[key], { ...context, parent }, depth + 1);
      }
      return;
    }
    const key = path.split(".").at(-1) ?? path;
    const operation = leafOperation(key, previous, next);
    if (operation === "reordered" && typeof previous === "number" && typeof next === "number") {
      addChange(path, operation, previous + 1, next + 1, context);
      return;
    }
    addChange(path, operation, previous, next, context);
  };

  compare(documentKey, before, after, {}, 0);
  return { changes, changeCount };
}

export function buildAuditRecord(documentKey: DocumentKey, before: unknown, after: unknown, actor?: string): AuditResult {
  const result = compareCmsValues(documentKey, before, after);
  const summary = buildAuditSummary(documentKey, result.changes, result.changeCount);
  return {
    ...result,
    summary: actor ? formatSummaryWithActor(summary, actor) : summary,
    action: deriveAuditAction(before, after, result.changes),
  };
}

export function formatPhilippineDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted.replace(/, (?=\d{1,2}:)/, " at ")} PHT`;
}

export function philippineDateBoundary(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const nextMidnightUtc = Date.UTC(year, month, day + (endOfDay ? 1 : 0), -8);
  return new Date(nextMidnightUtc - (endOfDay ? 1 : 0)).toISOString();
}

export function auditActorName(name?: string | null, email?: string | null, userId?: string | null) {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName.split(/\s+/)[0] ?? trimmedName;
  const local = email?.split("@")[0]?.split(/[._+-]/)[0];
  if (local) return `${local.charAt(0).toUpperCase()}${local.slice(1)}`;
  if (userId) return userId;
  return "An administrator";
}

export function formatSummaryWithActor(summary: string, actor: string) {
  if (!summary) return `${actor} updated content.`;
  if (summary.toLocaleLowerCase().startsWith(actor.toLocaleLowerCase())) return summary;
  return `${actor} ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
}

export function isGenericAuditSummary(summary?: string | null) {
  return !summary || /^(?:content|website content) updated\.?$/i.test(summary.trim());
}

export function buildRestoreSummary(documentKey: DocumentKey, version: number, savedAt: string, actor?: string) {
  const summary = `Restored ${documentLabels[documentKey]} to version ${version} created on ${formatPhilippineDateTime(savedAt)}.`;
  return actor ? formatSummaryWithActor(summary, actor) : summary;
}

export function previewableImageSrc(value: unknown) {
  if (typeof value !== "string") return undefined;
  if (value.startsWith("data:")) return undefined;
  if (/^(https?:\/\/|\/)[^\s]+$/.test(value)) return value;
  return undefined;
}

export function displayAuditValue(value: unknown, change: AuditChange) {
  if (value === undefined || value === null || value === "") return "—";
  if (change.operation === "reordered") return `Position ${String(value)}`;
  if (isImageSrcChange(change) || change.value_type === "image") {
    if (typeof value === "string" && value.startsWith("[embedded ")) return "Embedded image";
    const src = previewableImageSrc(value);
    if (src) {
      const file = src.split("?")[0]?.split("/").filter(Boolean).at(-1);
      return file ? `Image (${file})` : "Image";
    }
    return "Image";
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  try {
    const encoded = JSON.stringify(value);
    return encoded.length > 180 ? `${encoded.slice(0, 177)}…` : encoded;
  } catch {
    return "Updated value";
  }
}

export function changeStatusLabel(change: AuditChange) {
  if (isImageSrcChange(change)) return "Image replaced";
  if (change.operation === "reordered") return `Moved from position ${String(change.before)} to ${String(change.after)}`;
  if (change.path.endsWith(".archived") && change.after === true) return "Archived";
  if (change.path.endsWith(".archived") && change.after === false) return "Restored";
  if (change.operation === "created") return "Added";
  if (change.operation === "deleted") return "Removed";
  if (change.operation === "enabled") return "Enabled";
  if (change.operation === "disabled") return "Disabled";
  return "Updated";
}
