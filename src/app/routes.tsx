import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { LoadingState } from "@/components/ui/Feedback";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { normalizeAdminAuthEntryUrl } from "@/lib/adminAuth";
import { CmsPageOverride } from "@/components/pageBuilder/CmsPageOverride";

normalizeAdminAuthEntryUrl();

const Home = lazy(() => import("@/pages/Home"));
const Experiences = lazy(() => import("@/pages/Experiences"));
const SmartWellnessHotel = lazy(() => import("@/pages/SmartWellnessHotel"));
const ALMJapaneseRestaurant = lazy(() => import("@/pages/ALMJapaneseRestaurant"));
const HotspringEcofarm = lazy(() => import("@/pages/HotspringEcofarm"));
const ExperienceDetail = lazy(() => import("@/pages/ExperienceDetail"));
const VIPPrivilege = lazy(() => import("@/pages/VIPPrivilege"));
const About = lazy(() => import("@/pages/About"));
const Stories = lazy(() => import("@/pages/Stories"));
const StoryDetail = lazy(() => import("@/pages/StoryDetail"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Compliance = lazy(() => import("@/pages/Compliance"));
const Contact = lazy(() => import("@/pages/Contact"));
const CmsPage = lazy(() => import("@/pages/CmsPage"));
const Admin = lazy(() => import("@/pages/Admin"));
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));
const AdminForgotPassword = lazy(() => import("@/pages/AdminForgotPassword"));
const AdminResetPassword = lazy(() => import("@/pages/AdminResetPassword"));
const AdminAuthCallback = lazy(() => import("@/pages/AdminAuthCallback"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Component />
    </Suspense>
  );
}

function managedPage(slug: string, path: string, Component: LazyExoticComponent<ComponentType>) {
  return <CmsPageOverride slug={slug} path={path} fallback={page(Component)} />;
}

export const router = createBrowserRouter([
  { path: "/afhomes-admin", element: page(AdminLogin) },
  { path: "/admin/login", element: page(AdminLogin) },
  { path: "/admin/forgot-password", element: page(AdminForgotPassword) },
  { path: "/admin/reset-password", element: page(AdminResetPassword) },
  { path: "/admin/auth/callback", element: page(AdminAuthCallback) },
  {
    path: "/admin",
    element: <AdminGuard>{page(Admin)}</AdminGuard>,
  },
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: managedPage("home", "/", Home) },
      { path: "experiences", element: managedPage("experiences", "/experiences", Experiences) },
      { path: "experiences/smart-wellness-hotel", element: page(SmartWellnessHotel) },
      { path: "experiences/alm-japanese-restaurant", element: page(ALMJapaneseRestaurant) },
      { path: "experiences/hotspring-ecofarm-resort", element: page(HotspringEcofarm) },
      { path: "experiences/:slug", element: page(ExperienceDetail) },
      { path: "vip", element: managedPage("vip", "/vip", VIPPrivilege) },
      { path: "about", element: managedPage("about", "/about", About) },
      { path: "stories", element: managedPage("stories", "/stories", Stories) },
      { path: "stories/:slug", element: page(StoryDetail) },
      { path: "faq", element: managedPage("faq", "/faq", FAQ) },
      { path: "compliance", element: managedPage("compliance", "/compliance", Compliance) },
      { path: "contact", element: managedPage("contact", "/contact", Contact) },
      { path: ":slug", element: page(CmsPage) },
      { path: "*", element: page(NotFound) },
    ],
  },
]);
