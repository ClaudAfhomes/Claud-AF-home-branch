import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useBlocker, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cmsRepository, listHistory } from "@/lib/cms";
import { logoutAdmin } from "@/lib/adminAuth";
import { isStoryBackup } from "@/lib/storyBackup";
import { DraftContext, useAdminDraft } from "@/components/admin/DraftContext";
import { uploadImage } from "@/lib/media";
import { BackupPanel } from "@/components/admin/BackupPanel";
import { InquiryInbox } from "@/components/admin/InquiryInbox";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { PageContentEditor } from "@/components/admin/PageContentEditor";
import { SeoEditor } from "@/components/admin/SeoEditor";
import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { AdminIcon } from "@/components/admin/AdminIcon";
import { useAsync } from "@/hooks/useAsync";
import { confirmAction, promptText, showToast } from "@/lib/dialog";
import type { ImageSpec } from "@/lib/images";
import type { Experience, ExperienceStatus } from "@/types/experience";
import type { VipPlan, VipTierId } from "@/types/vip";
import type { FaqCategory } from "@/types/faq";
import type { Story } from "@/types/story";

type Tab =
  | "dashboard"
  | "home"
  | "about"
  | "experiences"
  | "faq"
  | "contact"
  | "seo"
  | "media"
  | "history"
  | "inbox"
  | "stories"
  | "vip"
  | "settings";
interface TabItem {
  id: Tab;
  label: string;
  icon: string;
  group: "Website Content" | "Library & activity";
}
const tabs: TabItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    group: "Website Content",
  },
  { id: "home", label: "Home", icon: "hero", group: "Website Content" },
  { id: "about", label: "About", icon: "pages", group: "Website Content" },
  {
    id: "experiences",
    label: "Experiences",
    icon: "rooms",
    group: "Website Content",
  },
  { id: "vip", label: "VIP", icon: "vip", group: "Website Content" },
  {
    id: "stories",
    label: "Stories",
    icon: "stories",
    group: "Website Content",
  },
  { id: "faq", label: "FAQ", icon: "faq", group: "Website Content" },
  {
    id: "contact",
    label: "Contact",
    icon: "contact",
    group: "Website Content",
  },
  {
    id: "media",
    label: "Media Library",
    icon: "media",
    group: "Library & activity",
  },
  {
    id: "inbox",
    label: "Inquiry Inbox",
    icon: "inbox",
    group: "Library & activity",
  },
  { id: "seo", label: "SEO", icon: "seo", group: "Library & activity" },
  {
    id: "history",
    label: "History",
    icon: "history",
    group: "Library & activity",
  },
  {
    id: "settings",
    label: "Settings",
    icon: "settings",
    group: "Website Content",
  },
];
const tabAliases: Record<string, Tab> = {
  overview: "dashboard",
  site: "settings",
  experiences: "experiences",
  hero: "home",
  rooms: "experiences",
  hotspring: "experiences",
  wellness: "experiences",
  alm: "experiences",
  pages: "dashboard",
  amenities: "dashboard",
  gallery: "dashboard",
  videos: "dashboard",
  offers: "dashboard",
  testimonials: "dashboard",
  backups: "history",
};

function SidebarButton({
  item,
  active,
  compact,
  onSelect,
}: {
  item: TabItem;
  active: boolean;
  compact: boolean;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <button
      type="button"
      title={item.label}
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.id)}
      className={`group flex w-full items-center rounded-xl py-2.5 text-left text-[0.82rem] font-semibold transition-colors ${compact ? "justify-center px-2" : "gap-3 px-3"} ${active ? "bg-leaf-500 text-pine-950 shadow-subtle" : "text-cream-200/75 hover:bg-white/8 hover:text-cream-50"}`}
    >
      <AdminIcon
        name={item.icon}
        className="h-[1.15rem] w-[1.15rem] shrink-0"
      />
      <span className={compact ? "hidden" : ""}>{item.label}</span>
      {active && (
        <span
          className={`h-1.5 w-1.5 rounded-full bg-pine-900 ${compact ? "hidden" : "ml-auto"}`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function CmsSidebar({
  activeTab,
  open: requestedOpen,
  onClose: dismiss,
  onSelect,
}: {
  activeTab: Tab;
  open: boolean;
  onClose: () => void;
  onSelect: (tab: Tab) => void;
}) {
  const [open, setOpen] = useState(requestedOpen);
  useEffect(() => {
    if (requestedOpen) setOpen(true);
  }, [requestedOpen]);
  useEffect(() => {
    document.body.classList.toggle("cms-sidebar-compact", !open);
    return () => document.body.classList.remove("cms-sidebar-compact");
  }, [open]);
  const onClose = () => {
    setOpen(false);
    dismiss();
  };
  const select = (tab: Tab) => {
    onSelect(tab);
    if (window.innerWidth < 1024) onClose();
  };
  const settings = tabs.find((item) => item.id === "settings")!;
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-navy-950/55 backdrop-blur-sm transition-opacity lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] flex-col bg-navy-950 text-cream-50 shadow-2xl transition-[width,transform] duration-300 ${open ? "translate-x-0" : "-translate-x-full lg:w-16 lg:translate-x-0"}`}
      >
        <div
          className={`flex h-20 items-center border-b border-white/10 ${open ? "justify-between px-5" : "justify-center px-2"}`}
        >
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`group ${open ? "" : "hidden"}`}
          >
            <p className="label-caps text-leaf-300">AFhomes</p>
            <p className="mt-1 text-sm font-semibold text-cream-50">
              Content Studio
            </p>
          </Link>
          <button
            type="button"
            onClick={() => (open ? onClose() : setOpen(true))}
            className="rounded-lg p-2 text-cream-200 hover:bg-white/10"
            aria-label={open ? "Minimize sidebar" : "Expand sidebar"}
          >
            {open ? "×" : "☰"}
          </button>
        </div>
        <nav
          className={`no-scrollbar flex-1 overflow-y-auto py-5 ${open ? "px-3" : "px-2"}`}
          aria-label="CMS navigation"
        >
          {(["Website Content", "Library & activity"] as const).map((group) => (
            <div key={group} className={open ? "mb-6" : "mb-3"}>
              <p
                className={`label-caps mb-2 px-3 text-cream-300/45 ${open ? "" : "hidden"}`}
              >
                {group}
              </p>
              <div className="space-y-1">
                {tabs
                  .filter(
                    (item) => item.group === group && item.id !== "settings",
                  )
                  .map((item) => (
                    <SidebarButton
                      key={item.id}
                      item={item}
                      active={activeTab === item.id}
                      compact={!open}
                      onSelect={select}
                    />
                  ))}
              </div>
            </div>
          ))}
        </nav>
        <div className={`border-t border-white/10 ${open ? "p-3" : "p-2"}`}>
          <SidebarButton
            item={settings}
            active={activeTab === "settings"}
            compact={!open}
            onSelect={select}
          />
          <p
            className={`mt-3 px-3 text-[0.66rem] text-cream-300/40 ${open ? "" : "hidden"}`}
          >
            Role-ready workspace · Admin access
          </p>
        </div>
      </aside>
    </>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

const internalRoutes = [
  "/",
  "/about",
  "/experiences",
  "/experiences/hotspring-ecofarm-resort",
  "/experiences/smart-wellness-hotel",
  "/experiences/alm-japanese-restaurant",
  "/vip",
  "/stories",
  "/faq",
  "/contact",
];

function Field({
  label,
  value,
  onChange,
  area = false,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  area?: boolean;
  type?: string;
}) {
  if (label === "Website URL" || label === "URL slug") return null;
  if (label === "Path")
    return (
      <label className="block">
        <span className="label-caps text-ink-500">Destination</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="cms-input"
        >
          {[...new Set([String(value), ...internalRoutes])].map((route) => (
            <option key={route} value={route}>
              {route === "/" ? "Home" : route}
            </option>
          ))}
        </select>
      </label>
    );
  if (type === "url")
    return (
      <div className="block">
        <span className="label-caps text-ink-500">{label}</span>
        <p className="mt-2 text-sm text-ink-600">
          Managed from the media library.
        </p>
      </div>
    );
  return (
    <label className="block">
      <span className="label-caps text-ink-500">{label}</span>
      {area ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="cms-input resize-y"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="cms-input"
        />
      )}
    </label>
  );
}

function ImageField({
  label,
  image,
  onChange,
}: {
  label: string;
  image: ImageSpec;
  onChange: (image: ImageSpec) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const readFile = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    try {
      onChange({ ...image, src: await uploadImage(file) });
    } catch (error) {
      void showToast(
        error instanceof Error ? error.message : "Upload failed",
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-cream-100/50 p-4 sm:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Field
            label={label}
            value={image.src}
            onChange={(value) => onChange({ ...image, src: value })}
            type="url"
          />
          <p className="mt-2 text-xs text-ink-400">
            Use a compressed WebP or JPEG, ideally under 1 MB. The centered crop
            is previewed below.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-semibold text-pine-900 hover:border-pine-800 hover:bg-pine-800 hover:text-cream-50">
            <span>
              {uploading
                ? "Uploading..."
                : image.src
                  ? "Replace"
                  : "Upload image"}
            </span>
            <input
              disabled={uploading}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
                event.target.value = "";
              }}
            />
          </label>
          {image.src && (
            <button
              type="button"
              className="px-3 text-sm font-semibold text-coral-700"
              onClick={() => onChange({ ...image, src: "" })}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center">
        <div className="aspect-4/3 overflow-hidden rounded-lg border border-line bg-cream-200">
          {image.src ? (
            <img
              src={image.src}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-ink-400">
              No image
            </span>
          )}
        </div>
        <Field
          label="Image description / alt text"
          value={image.alt}
          onChange={(value) => onChange({ ...image, alt: value })}
        />
      </div>
    </div>
  );
}

function Actions({
  archived,
  featured,
  onEdit,
  onArchive,
  onFeature,
  onDelete,
}: {
  archived?: boolean;
  featured?: boolean;
  onEdit?: () => void;
  onArchive: () => void;
  onFeature?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
      {onEdit && (
        <button
          type="button"
          className="text-pine-800 hover:text-leaf-700"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
      {onFeature && (
        <button
          type="button"
          className="text-pine-800 hover:text-leaf-700"
          onClick={onFeature}
        >
          {featured ? "Unfeature" : "Feature"}
        </button>
      )}
      <button
        type="button"
        className="text-pine-800 hover:text-leaf-700"
        onClick={onArchive}
      >
        {archived ? "Restore" : "Archive"}
      </button>
      <button
        type="button"
        className="text-coral-700 hover:text-coral-500"
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  onSave,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Save failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-cream-50 shadow-soft">
      <fieldset disabled={saving} className="p-5 sm:p-8">
        <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 lg:flex-row lg:items-end">
          <div>
            <p className="label-caps text-leaf-700">Content editor</p>
            <h2 className="font-display mt-1 text-4xl font-medium text-navy-900">
              {title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
              {description}
            </p>
            <p className="mt-2 text-xs font-semibold text-pine-800">
              Changes publish when you select Update.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                window.dispatchEvent(new Event("afhomes-cms-updated"))
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
            >
              Preview
            </Button>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => void save()}
            >
              {saving ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-coral-100 px-4 py-3 text-sm font-semibold text-coral-700"
          >
            {error}
          </p>
        )}
        {children}
      </fieldset>
    </section>
  );
}
export default function Admin() {
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const markDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyIds((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const dirty = dirtyIds.size > 0;
  const wasDirty = useRef(false);
  useEffect(() => {
    if (dirty && !wasDirty.current)
      void showToast(
        "You have unsaved changes. Select Update to publish them.",
        "warning",
      );
    wasDirty.current = dirty;
  }, [dirty]);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked") {
      void confirmAction(
        "Discard unsaved changes?",
        "Your latest edits will not be published.",
      ).then((confirmed) => (confirmed ? blocker.proceed() : blocker.reset()));
    }
  }, [blocker]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "";
  const tab =
    tabAliases[requestedTab] ??
    tabs.find((item) => item.id === requestedTab)?.id ??
    "dashboard";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setTab = (next: Tab) => {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set("tab", next);
      return updated;
    });
  };
  const notify = (message: string) => {
    const error = /failed|error|unable|invalid|required|must|could not/i.test(
      message,
    );
    void showToast(message, error ? "error" : "success");
  };
  const notice = "";
  const activeLabel =
    tabs.find((item) => item.id === tab)?.label ?? "Dashboard";
  return (
    <DraftContext.Provider value={markDirty}>
      <div className="min-h-screen bg-cream-100 text-ink-800">
        <CmsSidebar
          activeTab={tab}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSelect={setTab}
        />
        <div className="min-h-screen lg:pl-[18rem]">
          <header className="sticky top-0 z-30 border-b border-line bg-cream-50/95 backdrop-blur">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-7 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="rounded-xl border border-line p-2.5 text-pine-900 lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open CMS navigation"
                >
                  <span className="block h-0.5 w-5 bg-current" />
                  <span className="mt-1.5 block h-0.5 w-5 bg-current" />
                  <span className="mt-1.5 block h-0.5 w-5 bg-current" />
                </button>
                <div className="min-w-0">
                  <p className="label-caps text-ink-400">AFhomes CMS</p>
                  <h1 className="truncate font-display text-2xl font-medium text-navy-900">
                    {activeLabel}
                  </h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <span
                  role="status"
                  className={`hidden rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex ${dirty ? "bg-gold-100 text-ink-700" : "bg-leaf-100 text-pine-900"}`}
                >
                  <span
                    className={`mr-2 mt-1 h-1.5 w-1.5 rounded-full ${dirty ? "bg-gold-600" : "bg-leaf-500"}`}
                  />
                  {dirty ? "Unsaved changes" : "Up to date"}
                </span>
                <Link
                  to="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden rounded-full px-3 py-2 text-sm font-semibold text-pine-800 transition-colors hover:bg-leaf-100 hover:text-pine-900 md:block"
                >
                  View site ↗
                </Link>
                <button
                  type="button"
                  className="rounded-full px-3 py-2 text-sm font-semibold text-ink-500 transition-colors hover:bg-coral-100 hover:text-coral-700"
                  onClick={async () => {
                    if (
                      dirty &&
                      !window.confirm(
                        "Discard your unsaved changes and sign out?",
                      )
                    )
                      return;
                    try {
                      await logoutAdmin();
                      window.location.assign("/admin/login");
                    } catch {
                      notify("Sign out failed. Please try again.");
                    }
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </header>
          {notice && (
            <div
              className="fixed right-4 top-24 z-40 max-w-sm rounded-xl border border-leaf-300 bg-pine-900 px-5 py-4 text-sm font-semibold text-cream-50 shadow-2xl"
              role="status"
              aria-live="polite"
            >
              {notice}
            </div>
          )}
          <main className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
            {tab === "dashboard" && <Overview onSelect={setTab} />}
            {tab === "inbox" && <InquiryInbox />}
            {tab === "media" && <MediaLibrary />}
            {tab === "history" && <BackupPanel />}
            {tab === "settings" && <SettingsEditor notify={notify} />}
            {tab === "home" && (
              <PageContentEditor page="home" notify={notify} />
            )}
            {tab === "about" && (
              <PageContentEditor page="about" notify={notify} />
            )}
            {tab === "experiences" && <ExperiencesEditor notify={notify} />}
            {tab === "contact" && (
              <div className="space-y-6">
                <PageContentEditor page="contact" notify={notify} />
                <SettingsEditor notify={notify} initialPanel="locations" />
              </div>
            )}
            {tab === "seo" && <SeoEditor notify={notify} />}
            {tab === "vip" && (
              <div className="space-y-6">
                <PageContentEditor page="vip" notify={notify} />
                <VipEditor notify={notify} />
              </div>
            )}
            {tab === "faq" && (
              <div className="space-y-6">
                <PageContentEditor page="faq" notify={notify} />
                <FaqEditor notify={notify} />
              </div>
            )}
            {tab === "stories" && (
              <div className="space-y-6">
                <PageContentEditor page="stories" notify={notify} />
                <StoriesEditor notify={notify} />
              </div>
            )}
          </main>
        </div>
      </div>
    </DraftContext.Provider>
  );
}

function Overview({ onSelect }: { onSelect: (tab: Tab) => void }) {
  const { data: recent } = useAsync(() => listHistory(0), []);
  const experiences = cmsRepository.getAllExperiences();
  const stories = cmsRepository.getAllStories();
  const config = cmsRepository.getSiteConfig();
  const missingAlt =
    experiences.filter((item) => item.image.src && !item.image.alt.trim())
      .length +
    stories.filter((item) => item.cover.src && !item.cover.alt.trim()).length;
  const missingSeo =
    11 -
    new Set(
      config.pageSeo
        .filter((item) => item.metaDescription && item.openGraphImage.src)
        .map((item) => item.path),
    ).size;
  const cards: [string, string, Tab, string][] = [
    [
      "Edit homepage",
      "Update homepage text, buttons, and images",
      "home",
      "hero",
    ],
    [
      "Manage experiences",
      "Add, arrange, edit, or remove visitor experiences",
      "experiences",
      "rooms",
    ],
    [
      "Upload media",
      "Add optimized photos and videos to the library",
      "media",
      "media",
    ],
    [
      "Review SEO",
      `${Math.max(0, missingSeo)} pages need attention`,
      "seo",
      "seo",
    ],
  ];
  return (
    <div>
      <section className="rounded-2xl bg-pine-900 p-7 text-cream-50 shadow-lift sm:p-10">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="label-caps text-leaf-300">Good day, AFhomes team</p>
            <h2 className="font-display mt-3 text-4xl font-medium sm:text-5xl">
              Your website at a glance.
            </h2>
            <p className="mt-3 max-w-2xl text-cream-200/70">
              Manage content, keep visitor details accurate, and publish
              confidently from one calm workspace.
            </p>
          </div>
          <Button variant="accent" onClick={() => onSelect("home")}>
            Edit website content
          </Button>
        </div>
      </section>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-cream-50 p-5">
          <p className="label-caps text-ink-400">Experiences</p>
          <p className="font-display mt-2 text-4xl text-navy-900">
            {experiences.filter((item) => !item.archived).length}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Active visitor experiences
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-cream-50 p-5">
          <p className="label-caps text-ink-400">FAQs</p>
          <p className="font-display mt-2 text-4xl text-navy-900">
            {cmsRepository
              .getAllFaqCategories()
              .reduce((total, category) => total + category.items.length, 0)}
          </p>
          <p className="mt-1 text-sm text-ink-500">Published answers</p>
        </div>
        <div className="rounded-2xl border border-line bg-cream-50 p-5">
          <p className="label-caps text-ink-400">Last content update</p>
          <p className="font-display mt-2 text-2xl text-navy-900">
            {recent?.[0]
              ? new Date(recent[0].saved_at).toLocaleDateString()
              : "No edits yet"}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {recent?.[0]?.change_summary ??
              "History begins after the first save"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(missingAlt ? "media" : "seo")}
          className={`rounded-2xl border p-5 text-left ${missingAlt || missingSeo > 0 ? "border-gold-300 bg-gold-100/60" : "border-leaf-300 bg-leaf-100"}`}
        >
          <p className="label-caps text-ink-500">Content health</p>
          <p className="font-display mt-2 text-2xl text-navy-900">
            {missingAlt + Math.max(0, missingSeo)} items
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Missing SEO details or image alt text
          </p>
        </button>
      </div>
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="label-caps text-leaf-700">Quick actions</p>
            <h3 className="font-display mt-1 text-3xl text-navy-900">
              What would you like to update?
            </h3>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([title, detail, id, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="group rounded-2xl border border-line bg-cream-50 p-5 text-left shadow-subtle transition hover:-translate-y-0.5 hover:border-leaf-500 hover:shadow-soft"
            >
              <span className="inline-flex rounded-xl bg-leaf-100 p-2.5 text-pine-800">
                <AdminIcon name={icon} className="h-5 w-5" />
              </span>
              <p className="font-display mt-4 text-2xl font-medium text-navy-900">
                {title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">
                {detail}
              </p>
              <span className="mt-5 inline-block text-sm font-semibold text-pine-800">
                Open editor →
              </span>
            </button>
          ))}
        </div>
      </section>
      {recent && recent.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-cream-50 p-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="font-display text-2xl text-navy-900">
              Recent edits
            </h3>
            <button
              type="button"
              className="text-sm font-semibold text-pine-800"
              onClick={() => onSelect("history")}
            >
              View history
            </button>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {recent.slice(0, 5).map((row) => (
              <li
                key={row.id}
                className="flex flex-col justify-between gap-1 py-3 sm:flex-row"
              >
                <span className="text-sm text-ink-700">
                  {row.change_summary}
                </span>
                <time className="text-xs text-ink-400">
                  {new Date(row.saved_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ExperiencesEditor({
  notify,
  selectedSlug,
}: {
  notify: (message: string) => void;
  selectedSlug?: string;
}) {
  const [items, setItems] = useAdminDraft(() =>
    cmsRepository.getAllExperiences(),
  );
  const update = (index: number, patch: Partial<Experience>) => {
    const next = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setItems(next);
  };
  const add = async () => {
    const name = await promptText("Add an experience", "Experience name");
    if (!name) return;
    const baseSlug = slugify(name) || "new-experience";
    const slug = items.some((item) => item.slug === baseSlug)
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;
    const created: Experience = {
      id: makeId("experience"),
      slug,
      name,
      shortName: name,
      actionLabel: "Discover this experience",
      status: "in-development",
      statusLabel: "In Development",
      location: "Laguna, Philippines",
      headline: `Discover ${name}.`,
      summary: "Add a short introduction.",
      description: "Add the full visitor-facing description.",
      highlights: ["Add a highlight"],
      theme: "nature",
      accent: "leaf",
      image: { src: "", alt: "" },
    };
    setItems([created, ...items]);
    notify(
      "Experience added to the draft. Complete its details, then select Update.",
    );
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  };
  const remove = async (index: number) => {
    const item = items[index];
    if (
      !item ||
      !(await confirmAction(
        `Delete “${item.shortName}”?`,
        "This experience will be removed from the homepage and Experiences page after you select Update.",
      ))
    )
      return;
    setItems(items.filter((_, itemIndex) => itemIndex !== index));
    notify("Experience removed from the draft. Select Update to publish.");
  };
  const editableItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !selectedSlug || item.slug === selectedSlug);
  const pageName = selectedSlug
    ? (editableItems[0]?.item.shortName ?? "Experience")
    : "Experiences";
  return (
    <Section
      title={pageName}
      description={
        selectedSlug
          ? "Update the text, image, and visitor-facing status for this existing experience. Its page address is protected."
          : "Add a new visitor experience or update the content of an existing one. Page addresses are generated automatically."
      }
      onSave={async () => {
        await cmsRepository.saveExperiences(items);
        notify(`${pageName} content updated successfully.`);
      }}
    >
      {!selectedSlug && (
        <div className="mt-7">
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={() => void add()}
          >
            + Add experience
          </Button>
        </div>
      )}
      <div className="mt-8 space-y-8">
        {editableItems.map(({ item, index }) => (
          <article
            key={item.id}
            className={`border p-5 sm:p-7 ${item.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="label-caps text-ink-400">Position {index + 1}</p>
                <h3 className="font-display mt-1 text-2xl font-medium text-navy-900">
                  {item.shortName}
                </h3>
              </div>
              {!selectedSlug && (
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    disabled={index === 0}
                    className="rounded-full border border-line px-3 py-2 disabled:opacity-35"
                    onClick={() => move(index, 0)}
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    className="rounded-full border border-line px-3 py-2 disabled:opacity-35"
                    onClick={() => move(index, index - 1)}
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    className="rounded-full border border-line px-3 py-2 disabled:opacity-35"
                    onClick={() => move(index, index + 1)}
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    disabled={index === items.length - 1}
                    className="rounded-full border border-line px-3 py-2 disabled:opacity-35"
                    onClick={() => move(index, items.length - 1)}
                  >
                    Bottom
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-coral-300 px-3 py-2 text-coral-700"
                    onClick={() => void remove(index)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Name"
                value={item.name}
                onChange={(value) => update(index, { name: value })}
              />
              <Field
                label="Short name"
                value={item.shortName}
                onChange={(value) => update(index, { shortName: value })}
              />
              <Field
                label="Location"
                value={item.location}
                onChange={(value) => update(index, { location: value })}
              />
              <Field
                label="Status label"
                value={item.statusLabel}
                onChange={(value) => update(index, { statusLabel: value })}
              />
              <Field
                label="Headline"
                value={item.headline}
                onChange={(value) => update(index, { headline: value })}
              />
              <Field
                label="Action label"
                value={item.actionLabel}
                onChange={(value) => update(index, { actionLabel: value })}
              />
              <Field
                label="Summary"
                value={item.summary}
                onChange={(value) => update(index, { summary: value })}
                area
              />
              <Field
                label="Description"
                value={item.description}
                onChange={(value) => update(index, { description: value })}
                area
              />
              <Field
                label="Highlights (one per line)"
                value={item.highlights.join("\n")}
                onChange={(value) =>
                  update(index, {
                    highlights: value.split("\n").filter(Boolean),
                  })
                }
                area
              />
              <ImageField
                label="Experience image"
                image={item.image}
                onChange={(image) => update(index, { image })}
              />
              <label className="block">
                <span className="label-caps text-ink-500">Status</span>
                <select
                  value={item.status}
                  onChange={(event) =>
                    update(index, {
                      status: event.target.value as ExperienceStatus,
                    })
                  }
                  className="cms-input"
                >
                  <option value="open">Open</option>
                  <option value="opening-soon">Opening soon</option>
                  <option value="in-development">In development</option>
                </select>
              </label>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function VipEditor({ notify }: { notify: (message: string) => void }) {
  const [plans, setPlans] = useAdminDraft(() => cmsRepository.getAllVipPlans());
  const update = (index: number, patch: Partial<VipPlan>) => {
    const next = plans.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setPlans(next);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= plans.length || from === to) return;
    const next = [...plans];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPlans(next);
  };
  const add = () => {
    const next = [
      { ...emptyVipPlan, id: makeId("vip") as VipTierId },
      ...plans,
    ];
    setPlans(next);
    notify("VIP tier added");
  };
  const remove = async (index: number) => {
    if (
      !(await confirmAction(
        "Delete this VIP tier?",
        "It will be removed after you save the draft.",
      ))
    )
      return;
    const next = plans.filter((_, itemIndex) => itemIndex !== index);
    setPlans(next);
    notify("VIP tier removed from draft. Save changes to publish.");
  };
  const emptyVipPlan: VipPlan = {
    id: "bronze",
    name: "New Tier",
    discountPercent: 0,
    validityYears: 1,
    pointsPerYear: 0,
    totalPoints: 0,
    cardholders: "Single cardholder",
    benefits: ["Add a benefit"],
    accentText: "text-ink-500",
    accentBg: "bg-navy-300",
  };
  return (
    <Section
      title="VIP plans"
      description="Add, edit, arrange, feature, archive, restore, or delete membership tiers. The saved order is used on the public VIP page."
      onSave={async () => {
        await cmsRepository.saveVipPlans(plans);
        notify("VIP plans saved");
      }}
    >
      <div className="mt-7">
        <Button type="button" variant="accent" size="sm" onClick={add}>
          + Add VIP tier
        </Button>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <article
            key={plan.id}
            className={`border p-5 ${plan.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-medium text-navy-900">
                {plan.name}
              </h3>
              {plan.featured && <Badge tone="gold">Featured</Badge>}
            </div>
            <div className="mt-4">
              <div className="mb-4 rounded-xl bg-leaf-100 p-3">
                <label className="block text-xs font-semibold text-pine-900">
                  <span className="mb-2 block">Display position</span>
                  <select
                    className="w-full rounded-lg border border-leaf-300 bg-cream-50 px-3 py-2"
                    value={index}
                    onChange={(event) =>
                      move(index, Number(event.target.value))
                    }
                  >
                    {plans.map((item, position) => (
                      <option key={`${item.id}-${position}`} value={position}>
                        {position + 1} —{" "}
                        {position === 0
                          ? "First"
                          : position === plans.length - 1
                            ? "Last"
                            : `Position ${position + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    className="rounded-lg border border-leaf-300 bg-cream-50 px-3 py-2 text-xs font-semibold text-pine-900 disabled:opacity-35"
                  >
                    ↑ Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === plans.length - 1}
                    onClick={() => move(index, index + 1)}
                    className="rounded-lg border border-leaf-300 bg-cream-50 px-3 py-2 text-xs font-semibold text-pine-900 disabled:opacity-35"
                  >
                    ↓ Move down
                  </button>
                </div>
              </div>
              <Actions
                archived={plan.archived}
                featured={plan.featured}
                onArchive={() => update(index, { archived: !plan.archived })}
                onFeature={() => update(index, { featured: !plan.featured })}
                onDelete={() => remove(index)}
              />
            </div>
            <div className="mt-5 space-y-4">
              <Field
                label="Name"
                value={plan.name}
                onChange={(value) => update(index, { name: value })}
              />
              <Field
                label="Discount %"
                value={plan.discountPercent}
                onChange={(value) =>
                  update(index, { discountPercent: Number(value) })
                }
                type="number"
              />
              <Field
                label="Validity years"
                value={plan.validityYears}
                onChange={(value) =>
                  update(index, { validityYears: Number(value) })
                }
                type="number"
              />
              <Field
                label="Points per year"
                value={plan.pointsPerYear}
                onChange={(value) =>
                  update(index, { pointsPerYear: Number(value) })
                }
                type="number"
              />
              <Field
                label="Total points"
                value={plan.totalPoints}
                onChange={(value) =>
                  update(index, { totalPoints: Number(value) })
                }
                type="number"
              />
              <Field
                label="Cardholders"
                value={plan.cardholders}
                onChange={(value) => update(index, { cardholders: value })}
              />
              <Field
                label="Benefits (one per line)"
                value={plan.benefits.join("\n")}
                onChange={(value) =>
                  update(index, { benefits: value.split("\n").filter(Boolean) })
                }
                area
              />
              <ImageField
                label="VIP card image"
                image={plan.image ?? { src: "", alt: "" }}
                onChange={(image) => update(index, { image })}
              />
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function FaqEditor({ notify }: { notify: (message: string) => void }) {
  const [categories, setCategories] = useAdminDraft(() =>
    cmsRepository.getAllFaqCategories(),
  );
  const updateCategory = (index: number, patch: Partial<FaqCategory>) =>
    setCategories((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  const updateItem = (
    categoryIndex: number,
    itemIndex: number,
    patch: { question?: string; answer?: string; archived?: boolean },
  ) =>
    setCategories((current) =>
      current.map((category, currentCategoryIndex) =>
        currentCategoryIndex === categoryIndex
          ? {
              ...category,
              items: category.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? { ...item, ...patch } : item,
              ),
            }
          : category,
      ),
    );
  const addCategory = () => {
    const next = [
      {
        id: makeId("faq"),
        label: "New category",
        items: [{ question: "New question", answer: "New answer" }],
      },
      ...categories,
    ];
    setCategories(next);
    notify("FAQ category added");
  };
  return (
    <Section
      title="Frequently asked questions"
      description="Add, edit, archive, restore, or delete categories and questions."
      onSave={async () => {
        await cmsRepository.saveFaqCategories(categories);
        notify("FAQs saved");
      }}
    >
      <div className="mt-7">
        <Button type="button" variant="accent" size="sm" onClick={addCategory}>
          + Add FAQ category
        </Button>
      </div>
      <div className="mt-8 space-y-8">
        {categories.map((category, categoryIndex) => (
          <article
            key={category.id}
            className={`border p-5 sm:p-7 ${category.archived ? "border-coral-300 bg-coral-100/30" : "border-line"}`}
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <Field
                label="Category label"
                value={category.label}
                onChange={(value) =>
                  updateCategory(categoryIndex, { label: value })
                }
              />
              <Actions
                archived={category.archived}
                onArchive={() =>
                  updateCategory(categoryIndex, {
                    archived: !category.archived,
                  })
                }
                onDelete={() => {
                  if (!window.confirm("Permanently delete this FAQ category?"))
                    return;
                  const next = categories.filter(
                    (_, index) => index !== categoryIndex,
                  );
                  setCategories(next);
                  notify(
                    "FAQ category removed from draft. Save changes to publish.",
                  );
                }}
              />
            </div>
            <div className="mt-6 space-y-5">
              {category.items.map((item, itemIndex) => (
                <div
                  key={`${category.id}-${itemIndex}`}
                  className={`border-t border-line pt-5 ${item.archived ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between gap-3">
                    <p className="label-caps text-ink-500">
                      Question {itemIndex + 1}
                    </p>
                    <Actions
                      archived={item.archived}
                      onArchive={() =>
                        updateItem(categoryIndex, itemIndex, {
                          archived: !item.archived,
                        })
                      }
                      onDelete={() =>
                        updateCategory(categoryIndex, {
                          items: category.items.filter(
                            (_, index) => index !== itemIndex,
                          ),
                        })
                      }
                    />
                  </div>
                  <div className="mt-3 space-y-4">
                    <Field
                      label="Question"
                      value={item.question}
                      onChange={(value) =>
                        updateItem(categoryIndex, itemIndex, {
                          question: value,
                        })
                      }
                    />
                    <Field
                      label="Answer"
                      value={item.answer}
                      onChange={(value) =>
                        updateItem(categoryIndex, itemIndex, { answer: value })
                      }
                      area
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateCategory(categoryIndex, {
                    items: [
                      ...category.items,
                      { question: "New question", answer: "New answer" },
                    ],
                  })
                }
              >
                + Add question
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}

function StoriesEditor({ notify }: { notify: (message: string) => void }) {
  const [stories, setStories] = useAdminDraft(() =>
    cmsRepository.getAllStories(),
  );
  const [active, setActive] = useState<Story | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const save = (story: Story) => {
    const normalized = {
      ...story,
      id: story.id || makeId("story"),
      slug: slugify(story.slug || story.title),
      content: story.content.map((text) => text.trim()).filter(Boolean),
    };
    const next = stories.some((item) => item.id === normalized.id)
      ? stories.map((item) => (item.id === normalized.id ? normalized : item))
      : [normalized, ...stories];
    setStories(next);
    setActive(null);
    notify("Story added to draft. Save changes to publish.");
  };
  const remove = async (story: Story) => {
    if (
      !(await confirmAction(
        `Delete “${story.title}”?`,
        "It will be removed after you save the draft.",
      ))
    )
      return;
    const next = stories.filter((item) => item.id !== story.id);
    setStories(next);
    notify("Story removed from draft. Save changes to publish.");
  };
  return (
    <Section
      title="Stories & Insights"
      description="Add, edit, feature, archive, restore, or delete editorial content."
      onSave={async () => {
        await cmsRepository.replaceStories(stories);
        notify("Stories saved");
      }}
    >
      <div className="mt-7 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={() =>
            setActive({
              id: "",
              slug: "",
              title: "",
              category: "Blog",
              date: "",
              excerpt: "",
              content: [""],
              cover: { src: "", alt: "" },
            })
          }
        >
          + Add story
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(stories, null, 2)], {
                type: "application/json",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "afhomes-stories.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download backup
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => importRef.current?.click()}
        >
          Restore backup
        </Button>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const restored = JSON.parse(await file.text()) as Story[];
              if (!isStoryBackup(restored)) throw new Error();
              setStories(restored);
              notify("Backup loaded into draft. Save changes to publish.");
            } catch {
              notify("That backup file is not valid");
            }
            event.target.value = "";
          }}
        />
      </div>
      <div className="mt-7 divide-y divide-line border border-line bg-cream-50">
        {stories.map((story) => (
          <div
            key={story.id}
            className={`flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${story.archived ? "bg-coral-100/30" : ""}`}
          >
            <div>
              <p className="font-display text-xl font-medium text-navy-900">
                {story.title}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {story.category} · {story.date}
              </p>
            </div>
            <Actions
              archived={story.archived}
              featured={story.featured}
              onEdit={() => setActive(story)}
              onArchive={() => {
                const next = stories.map((item) =>
                  item.id === story.id
                    ? { ...item, archived: !item.archived }
                    : item,
                );
                setStories(next);
              }}
              onFeature={() => {
                const next = stories.map((item) =>
                  item.id === story.id
                    ? { ...item, featured: !item.featured }
                    : item,
                );
                setStories(next);
              }}
              onDelete={() => remove(story)}
            />
          </div>
        ))}
      </div>
      {active && (
        <StoryForm
          story={active}
          onCancel={() => setActive(null)}
          onSave={save}
        />
      )}
    </Section>
  );
}

function StoryForm({
  story,
  onCancel,
  onSave,
}: {
  story: Story;
  onCancel: () => void;
  onSave: (story: Story) => void;
}) {
  const [draft, setDraft] = useState(story);
  const update = <K extends keyof Story>(key: K, value: Story[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  return (
    <div className="fixed inset-0 z-100 overflow-y-auto bg-navy-950/70 px-4 py-8">
      <form
        className="mx-auto max-w-3xl border border-line bg-cream-50 p-6 shadow-2xl sm:p-10"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="flex items-center justify-between border-b border-line pb-6">
          <h3 className="font-display text-3xl font-medium text-navy-900">
            {draft.id ? "Edit story" : "New story"}
          </h3>
          <button
            type="button"
            className="text-sm font-semibold text-ink-500"
            onClick={onCancel}
          >
            Close
          </button>
        </div>
        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field
              label="Title"
              value={draft.title}
              onChange={(value) => update("title", value)}
            />
          </div>
          <Field
            label="Category"
            value={draft.category}
            onChange={(value) => update("category", value)}
          />
          <Field
            label="Date"
            value={draft.date}
            onChange={(value) => update("date", value)}
          />
          <div className="sm:col-span-2">
            <Field
              label="URL slug"
              value={draft.slug}
              onChange={(value) => update("slug", slugify(value))}
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Excerpt"
              value={draft.excerpt}
              onChange={(value) => update("excerpt", value)}
              area
            />
          </div>
          <div className="sm:col-span-2">
            <Field
              label="Paragraphs (blank line between paragraphs)"
              value={draft.content.join("\n\n")}
              onChange={(value) => update("content", value.split(/\n\s*\n/))}
              area
            />
          </div>
          <ImageField
            label="Cover image"
            image={draft.cover}
            onChange={(image) => update("cover", image)}
          />
        </div>
        <div className="mt-8 flex justify-end gap-3 border-t border-line pt-6">
          <Button type="button" variant="outline" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" size="md">
            Save story
          </Button>
        </div>
      </form>
    </div>
  );
}
