import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAdminDraft } from "@/components/admin/DraftContext";
import { cmsRepository } from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/media";
import type { ImageSpec } from "@/lib/images";
import type { PageSeoSettings, SiteConfig } from "@/types/site";

const managedPages = [
  ["/", "Home", "home"],
  ["/about", "About", "about"],
  ["/experiences", "Experiences", "experiences"],
  [
    "/experiences/smart-wellness-hotel",
    "Smart Wellness Hotel",
    "smart-wellness-hotel",
  ],
  [
    "/experiences/alm-japanese-restaurant",
    "ALM Japanese Restaurant",
    "alm-japanese-restaurant",
  ],
  [
    "/experiences/hotspring-ecofarm-resort",
    "Hotspring & Ecofarm Resort",
    "hotspring-ecofarm-resort",
  ],
  ["/vip", "VIP Privilege", "vip"],
  ["/stories", "Stories", "stories"],
  ["/faq", "FAQ", "faq"],
  ["/compliance", "Compliance", "compliance"],
  ["/contact", "Contact", "contact"],
] as const;

function Counter({
  value,
  recommended,
  maximum,
}: {
  value: string;
  recommended: number;
  maximum: number;
}) {
  const warning = value.length > recommended;
  return (
    <span
      className={`text-xs ${warning ? "font-semibold text-coral-700" : "text-ink-400"}`}
    >
      {value.length}/{maximum}
      {warning ? " · longer than recommended" : ""}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  area = false,
  recommended,
  maximum = 200,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  area?: boolean;
  recommended?: number;
  maximum?: number;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3">
        <span className="label-caps text-ink-500">{label}</span>
        {recommended && (
          <Counter value={value} recommended={recommended} maximum={maximum} />
        )}
      </span>
      {area ? (
        <textarea
          rows={4}
          maxLength={maximum}
          className="cms-input resize-y"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          maxLength={maximum}
          className="cms-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function SeoImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ImageSpec;
  onChange: (image: ImageSpec) => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="rounded-xl border border-line bg-cream-100/60 p-4 sm:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="aspect-video w-full max-w-44 overflow-hidden rounded-lg border border-line bg-cream-200">
          {value.src ? (
            <img
              src={value.src}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-3 text-center text-xs text-ink-400">
              No image selected
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="label-caps text-ink-500">{label}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">
            Use a compressed WebP or JPEG. Social images work best at 1200 × 630
            px.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-full bg-pine-800 px-4 py-2 text-xs font-semibold text-cream-50">
              <span>
                {uploading ? "Uploading…" : value.src ? "Replace" : "Upload"}
              </span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setUploading(true);
                  try {
                    onChange({ ...value, src: await uploadImage(file) });
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {value.src && (
              <button
                type="button"
                className="text-xs font-semibold text-coral-700"
                onClick={() => onChange({ ...value, src: "" })}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>
      <label className="mt-4 block">
        <span className="label-caps text-ink-500">Image alt text</span>
        <input
          className="cms-input"
          value={value.alt}
          onChange={(event) => onChange({ ...value, alt: event.target.value })}
        />
      </label>
    </div>
  );
}

function emptyPage(path: string, slug: string): PageSeoSettings {
  return {
    path,
    slug,
    seoTitle: "",
    metaDescription: "",
    openGraphTitle: "",
    openGraphDescription: "",
    openGraphImage: { src: "", alt: "" },
  };
}

export function SeoEditor({ notify }: { notify: (message: string) => void }) {
  const [config, setConfig] = useAdminDraft(() =>
    cmsRepository.getSiteConfig(),
  );
  const [selectedPath, setSelectedPath] = useState("/");
  const [saving, setSaving] = useState(false);
  const pageDefinition =
    managedPages.find(([path]) => path === selectedPath) ?? managedPages[0];
  const page =
    config.pageSeo.find((item) => item.path === selectedPath) ??
    emptyPage(pageDefinition[0], pageDefinition[2]);
  const updateSeo = <K extends keyof SiteConfig["seo"]>(
    key: K,
    value: SiteConfig["seo"][K],
  ) =>
    setConfig((current) => ({
      ...current,
      seo: { ...current.seo, [key]: value },
    }));
  const updatePage = <K extends keyof PageSeoSettings>(
    key: K,
    value: PageSeoSettings[K],
  ) =>
    setConfig((current) => {
      const exists = current.pageSeo.some((item) => item.path === selectedPath);
      const next = {
        ...(current.pageSeo.find((item) => item.path === selectedPath) ?? page),
        [key]: value,
      };
      return {
        ...current,
        pageSeo: exists
          ? current.pageSeo.map((item) =>
              item.path === selectedPath ? next : item,
            )
          : [...current.pageSeo, next],
      };
    });
  const reset = () => setConfig(cmsRepository.getSiteConfig());
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await cmsRepository.saveSiteConfig(config);
      if (supabase) {
        const { error } = await supabase.functions.invoke("trigger-site-build");
        notify(error ? "SEO saved. The static-page rebuild could not be requested; publish a deployment manually." : "SEO saved and a fresh static-page deployment was requested.");
      } else {
        notify("SEO settings updated successfully.");
      }
    } catch (cause) {
      notify(
        cause instanceof Error
          ? `SEO update failed: ${cause.message}`
          : "SEO update failed.",
      );
    } finally {
      setSaving(false);
    }
  };
  const missingCount = managedPages.filter(([path]) => {
    const item = config.pageSeo.find((candidate) => candidate.path === path);
    return !item?.metaDescription || !item.openGraphImage.src;
  }).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-soft">
      <header className="border-b border-line px-5 py-6 sm:px-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="label-caps text-leaf-700">Search appearance</p>
            <h2 className="font-display mt-2 text-4xl font-medium text-navy-900">
              SEO
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              Control search titles, descriptions, social previews, canonical
              URLs, and the resort’s structured data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.open(selectedPath, "_blank", "noopener,noreferrer")
              }
            >
              View live page
            </Button>
            <Button
              size="sm"
              variant="accent"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Updating…" : "Update SEO"}
            </Button>
          </div>
        </div>
      </header>
      <div className="grid lg:grid-cols-[15rem_1fr]">
        <nav
          className="border-b border-line bg-sage-100/50 p-4 lg:border-r lg:border-b-0"
          aria-label="SEO settings"
        >
          <a
            href="#global-seo"
            className="block rounded-lg bg-pine-800 px-4 py-3 text-sm font-semibold text-cream-50"
          >
            Global defaults
          </a>
          <p className="label-caps mt-6 px-3 text-ink-400">Page settings</p>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto lg:max-h-none">
            {managedPages.map(([path, label]) => (
              <button
                key={path}
                type="button"
                onClick={() => setSelectedPath(path)}
                className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm ${selectedPath === path ? "bg-leaf-100 font-semibold text-pine-900" : "text-ink-600 hover:bg-cream-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
        <div className="space-y-8 p-5 sm:p-8">
          <div
            className={`rounded-xl border p-4 text-sm ${missingCount ? "border-gold-300 bg-gold-100/60 text-ink-700" : "border-leaf-300 bg-leaf-100 text-pine-900"}`}
          >
            <strong>SEO health:</strong>{" "}
            {missingCount
              ? `${missingCount} managed page${missingCount === 1 ? " needs" : "s need"} a description or social image.`
              : "Every managed page has a description and social image."}
          </div>
          <details
            id="global-seo"
            open
            className="rounded-xl border border-line p-5"
          >
            <summary className="cursor-pointer font-display text-2xl font-medium text-navy-900">
              Global defaults
            </summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  label="Site title"
                  value={config.seo.siteTitle}
                  onChange={(value) => updateSeo("siteTitle", value)}
                  recommended={60}
                />
              </div>
              <TextField
                label="Title template"
                value={config.seo.titleTemplate}
                onChange={(value) => updateSeo("titleTemplate", value)}
              />
              <TextField
                label="Canonical site URL"
                value={config.seo.canonicalSiteUrl}
                onChange={(value) => updateSeo("canonicalSiteUrl", value)}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Default meta description"
                  value={config.seo.metaDescription}
                  onChange={(value) => updateSeo("metaDescription", value)}
                  area
                  recommended={160}
                  maximum={320}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="Keywords · comma separated"
                  value={config.seo.keywords.join(", ")}
                  onChange={(value) =>
                    updateSeo(
                      "keywords",
                      value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .slice(0, 30),
                    )
                  }
                  maximum={1000}
                />
              </div>
              <SeoImageField
                label="Default social sharing image"
                value={config.seo.defaultSocialImage}
                onChange={(value) => updateSeo("defaultSocialImage", value)}
              />
              <SeoImageField
                label="Favicon"
                value={config.seo.favicon}
                onChange={(value) => updateSeo("favicon", value)}
              />
            </div>
          </details>
          <details open className="rounded-xl border border-line p-5">
            <summary className="cursor-pointer font-display text-2xl font-medium text-navy-900">
              {pageDefinition[1]} search preview
            </summary>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  label="Search title"
                  value={page.seoTitle}
                  onChange={(value) => updatePage("seoTitle", value)}
                  recommended={60}
                />
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="Search description"
                  value={page.metaDescription}
                  onChange={(value) => updatePage("metaDescription", value)}
                  area
                  recommended={160}
                  maximum={500}
                />
              </div>
              <TextField
                label="Social sharing title"
                value={page.openGraphTitle}
                onChange={(value) => updatePage("openGraphTitle", value)}
                recommended={60}
              />
              <TextField
                label="Social sharing description"
                value={page.openGraphDescription}
                onChange={(value) => updatePage("openGraphDescription", value)}
                area
                recommended={160}
                maximum={500}
              />
              <SeoImageField
                label="Social sharing image"
                value={page.openGraphImage}
                onChange={(value) => updatePage("openGraphImage", value)}
              />
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
