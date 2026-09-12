import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminDraft } from "@/components/admin/DraftContext";
import { cmsRepository, saveDocuments } from "@/lib/cms";
import { uploadImage } from "@/lib/media";
import type { PageContent } from "@/types/pageContent";
import type { CmsMediaBlock } from "@/types/mediaBlock";

type PageKey = keyof PageContent;
type EditableValue =
  | string
  | number
  | boolean
  | EditableObject
  | EditableValue[];
interface EditableObject {
  [key: string]: EditableValue;
}

const labels: Record<string, string> = {
  lede: "Description",
  body: "Description",
  title: "Heading",
  eyebrow: "Small heading",
  heroTitle: "Main heading",
  heroLede: "Introduction",
  heroBadge: "Top label",
  heroPrimaryCta: "Primary button text",
  heroSecondaryCta: "Secondary button text",
  ctaPrimaryCta: "Primary button text",
  ctaSecondaryCta: "Secondary button text",
  src: "Image",
  alt: "Image description",
  value: "Value",
  label: "Label",
  note: "Supporting text",
  phoneLabel: "Phone label",
  emailLabel: "Email label",
  formTitle: "Form heading",
  formLede: "Form introduction",
};
const hiddenDesignFields = new Set(["ghost", "accent", "ring", "text", "line"]);

const pageDetails: Record<
  PageKey,
  { title: string; description: string; route: string }
> = {
  home: {
    title: "Home",
    description:
      "Update the words and images visitors see across the homepage.",
    route: "/",
  },
  about: {
    title: "About",
    description:
      "Update the AFhomes story, vision, mission, and company information.",
    route: "/about",
  },
  compliance: {
    title: "Compliance",
    description: "Update public compliance and transparency information.",
    route: "/compliance",
  },
  faq: {
    title: "FAQ page",
    description:
      "Update the headings and supporting text around the frequently asked questions.",
    route: "/faq",
  },
  contact: {
    title: "Contact",
    description: "Update the headings and instructions on the contact page.",
    route: "/contact",
  },
  experiences: {
    title: "Experiences",
    description: "Update the introduction shown above the AFhomes experiences.",
    route: "/experiences",
  },
  vip: {
    title: "VIP",
    description:
      "Update the VIP page introduction, guidance, and program information.",
    route: "/vip",
  },
  stories: {
    title: "Stories",
    description: "Update the introduction shown on the stories page.",
    route: "/stories",
  },
};

function friendly(key: string) {
  if (labels[key]) return labels[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function ImageEditor({
  value,
  change,
}: {
  value: EditableObject;
  change: (value: EditableObject) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const src = typeof value.src === "string" ? value.src : "";
  const alt = typeof value.alt === "string" ? value.alt : "";
  return (
    <div className="rounded-xl border border-line bg-cream-100/60 p-4 sm:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="aspect-video w-full max-w-56 overflow-hidden rounded-lg bg-cream-200">
          {src ? (
            <img src={src} alt={alt} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-sm text-ink-400">
              No image selected
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-navy-900">Image</p>
          <p className="mt-1 text-xs text-ink-500">
            Use a clear WebP or JPEG. Landscape images work best for wide
            sections.
          </p>
          <label className="mt-3 inline-flex cursor-pointer rounded-full bg-pine-800 px-4 py-2 text-xs font-semibold text-cream-50">
            {uploading ? "Uploading…" : src ? "Replace image" : "Upload image"}
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  change({
                    ...value,
                    src: await uploadImage(file),
                    alt: alt || file.name.replace(/\.[^.]+$/, ""),
                  });
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="label-caps text-ink-500">Image description</span>
        <input
          className="cms-input"
          value={alt}
          onChange={(event) => change({ ...value, alt: event.target.value })}
        />
      </label>
    </div>
  );
}

function ValueFields({
  name,
  value,
  change,
  depth = 0,
}: {
  name: string;
  value: EditableValue;
  change: (value: EditableValue) => void;
  depth?: number;
}) {
  if (typeof value === "string")
    return (
      <label className={value.length > 80 ? "sm:col-span-2" : ""}>
        <span className="label-caps text-ink-500">{friendly(name)}</span>
        {value.length > 80 ? (
          <textarea
            rows={4}
            className="cms-input resize-y"
            value={value}
            onChange={(event) => change(event.target.value)}
          />
        ) : (
          <input
            className="cms-input"
            value={value}
            onChange={(event) => change(event.target.value)}
          />
        )}
      </label>
    );
  if (typeof value === "number")
    return (
      <label>
        <span className="label-caps text-ink-500">{friendly(name)}</span>
        <input
          type="number"
          className="cms-input"
          value={value}
          onChange={(event) => change(Number(event.target.value))}
        />
      </label>
    );
  if (typeof value === "boolean")
    return (
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => change(event.target.checked)}
        />
        {friendly(name)}
      </label>
    );
  if (Array.isArray(value))
    return (
      <div className="space-y-4 sm:col-span-2">
        <h4 className="font-display text-xl text-navy-900">{friendly(name)}</h4>
        {value.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-line bg-cream-100/40 p-4"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-ink-400">
              Item {index + 1}
            </p>
            <ValueFields
              name={`${name} item`}
              value={item}
              change={(next) =>
                change(
                  value.map((current, itemIndex) =>
                    itemIndex === index ? next : current,
                  ),
                )
              }
              depth={depth + 1}
            />
          </div>
        ))}
      </div>
    );
  const object = value as EditableObject;
  if (typeof object.src === "string" && typeof object.alt === "string")
    return <ImageEditor value={object} change={change} />;
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${depth ? "" : "sm:col-span-2"}`}
    >
      {Object.entries(object)
        .filter(([key]) => !hiddenDesignFields.has(key))
        .map(([key, child]) => (
          <ValueFields
            key={key}
            name={key}
            value={child}
            change={(next) => change({ ...object, [key]: next })}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

export function PageContentEditor({
  page,
  notify,
}: {
  page: PageKey;
  notify: (message: string) => void;
}) {
  const [draft, setDraft] = useAdminDraft(() => ({
    pageContent: cmsRepository.getPageContent(),
    mediaBlocks: cmsRepository.getMediaBlocks(),
  }));
  const [saving, setSaving] = useState(false);
  const details = pageDetails[page];
  const content = draft.pageContent;
  const setContent = (
    next: PageContent | ((current: PageContent) => PageContent),
  ) =>
    setDraft((current) => ({
      ...current,
      pageContent:
        typeof next === "function" ? next(current.pageContent) : next,
    }));
  const pageContent = content[page] as unknown as EditableObject;
  const heroMedia = draft.mediaBlocks.find(
    (block) => block.page === "/" && block.placement === "page-background",
  );
  const updateHeroMedia = (image: EditableObject) =>
    setDraft((current) => {
      const mediaPatch = {
        src: String(image.src ?? ""),
        alt: String(image.alt ?? ""),
        kind: "image" as const,
      };
      if (heroMedia)
        return {
          ...current,
          mediaBlocks: current.mediaBlocks.map((block) =>
            block.id === heroMedia.id ? { ...block, ...mediaPatch } : block,
          ),
        };
      const created: CmsMediaBlock = {
        id: crypto.randomUUID(),
        page: "/",
        placement: "page-background",
        caption: "",
        width: "full",
        fit: "cover",
        position: "center",
        overlay: "medium",
        ...mediaPatch,
      };
      return { ...current, mediaBlocks: [...current.mediaBlocks, created] };
    });
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (page === "home")
        await saveDocuments({
          pageContent: content,
          mediaBlocks: draft.mediaBlocks,
        });
      else await cmsRepository.savePageContent(content);
      notify(`${details.title} content updated successfully.`);
    } catch (cause) {
      notify(
        cause instanceof Error
          ? `Update failed: ${cause.message}`
          : "Update failed.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-soft">
      <header className="border-b border-line px-5 py-6 sm:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="label-caps text-leaf-700">Website content</p>
            <h2 className="font-display mt-2 text-4xl font-medium text-navy-900">
              {details.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              {details.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft({
                  pageContent: cmsRepository.getPageContent(),
                  mediaBlocks: cmsRepository.getMediaBlocks(),
                })
              }
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(details.route, "_blank", "noopener,noreferrer")
              }
            >
              Preview
            </Button>
            <Button
              size="sm"
              variant="accent"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </header>
      <div className="p-5 sm:p-8">
        {page === "home" && (
          <div className="mb-6">
            <h3 className="font-display mb-4 text-2xl text-navy-900">
              Hero background
            </h3>
            <ImageEditor
              value={{ src: heroMedia?.src ?? "", alt: heroMedia?.alt ?? "" }}
              change={updateHeroMedia}
            />
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <ValueFields
            name={page}
            value={pageContent}
            change={(value) =>
              setContent((current) => ({
                ...current,
                [page]: value as PageContent[PageKey],
              }))
            }
          />
        </div>
      </div>
    </section>
  );
}
